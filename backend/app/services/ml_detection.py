"""Cyber DNA v25 Isolation Forest inference service.

The supplied v25 artifact is the original trained Isolation Forest.  The notebook
also supplies the authoritative v25 transformation: consecutive user/host hourly
count deltas -> signed log1p -> saved per-feature scales -> clip [-5, 5].
The remaining integration limitation is the event-ID-to-feature mapping: the
notebook does not ship the collector mapping, so the explicit Windows Security
mapping below is marked as a compatibility adapter.
"""
from __future__ import annotations
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
import json
import threading
import warnings

from app.core.config import settings

FEATURES = [
    "successful_logons", "failed_logons", "logoffs",
    "explicit_credential_events", "privilege_events", "process_starts",
    "kerberos_tgt_events", "kerberos_service_ticket_events",
    "credential_validation_events",
]

EVENT_FEATURES = {
    4624: {"successful_logons"},
    4625: {"failed_logons"},
    4634: {"logoffs"}, 4647: {"logoffs"},
    4648: {"explicit_credential_events"},
    4672: {"privilege_events"}, 4673: {"privilege_events"}, 4674: {"privilege_events"},
    4728: {"privilege_events"}, 4729: {"privilege_events"},
    4732: {"privilege_events"}, 4733: {"privilege_events"},
    4756: {"privilege_events"}, 4757: {"privilege_events"},
    4688: {"process_starts"},
    4768: {"kerberos_tgt_events"},
    4769: {"kerberos_service_ticket_events"},
    4776: {"credential_validation_events"},
}

_model = None
_config = None
_lock = threading.Lock()
_load_error: str | None = None
_load_warning: str | None = None


def _paths() -> tuple[Path, Path]:
    root = Path(__file__).resolve().parents[2]
    return root / settings.ML_MODEL_PATH, root / settings.ML_CONFIG_PATH


def load_model():
    global _model, _config, _load_error, _load_warning
    if not settings.ML_ENABLED:
        return None, None
    if _model is not None:
        return _model, _config
    with _lock:
        if _model is not None:
            return _model, _config
        try:
            import joblib
            model_path, config_path = _paths()
            if not model_path.exists() or not config_path.exists():
                raise FileNotFoundError(f"Missing model artifact or config: {model_path}")
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            expected = cfg.get("features")
            if expected != FEATURES:
                raise ValueError(f"Model feature definition mismatch: expected {FEATURES}, got {expected}")
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                model = joblib.load(model_path)
            version_warnings = [str(item.message) for item in caught if "Trying to unpickle estimator" in str(item.message)]
            _load_warning = version_warnings[0] if version_warnings else None
            if getattr(model, "n_features_in_", None) != len(FEATURES):
                raise ValueError("Model expects a different number of features")
            names = list(getattr(model, "feature_names_in_", []))
            if names and names != FEATURES:
                raise ValueError(f"Model feature order mismatch: {names}")
            _model, _config = model, cfg
            _load_error = None
        except Exception as exc:
            _load_error = str(exc)
            _load_warning = None
            _model, _config = None, None
    return _model, _config


def status() -> dict[str, Any]:
    model, cfg = load_model()
    warning = _load_error
    compatibility = "unavailable"
    if model is not None:
        compatibility = "artifact_loaded_exact_v25_transform_mapping_compatibility"
        warning = (
            "The original v25 artifact and notebook-defined hourly-delta preprocessing are loaded. "
            "The collector event-ID-to-feature mapping was not supplied by the training package, so "
            "the explicit Windows Security mapping is a compatibility adapter and has not been independently "
            "validated against the original aggregation pipeline."
        )
        if _load_warning:
            warning += " Serialized estimator version warning: " + _load_warning
    return {
        "enabled": bool(settings.ML_ENABLED),
        "available": model is not None,
        "model": "cyberdna_v25_isolation_forest" if model is not None else None,
        "model_version": "v25" if model is not None else None,
        "feature_names": FEATURES,
        "compatibility": compatibility,
        "feature_transform": "consecutive user/host hourly deltas -> signed log1p -> saved v25 scales -> clip [-5,5]",
        "event_mapping": "Windows Security event-ID compatibility adapter; original collector mapping not supplied",
        "score_semantics": "anomaly_score = -sklearn IsolationForest decision_function; higher is more anomalous; not a probability",
        "threshold_semantics": "anomaly when anomaly_score >= saved calibration threshold model_score_p99",
        "threshold_p99": (cfg or {}).get("thresholds", {}).get("model_score_p99") if cfg else None,
        "threshold_p995": (cfg or {}).get("thresholds", {}).get("model_score_p995") if cfg else None,
        "warning": warning,
    }


def _as_utc(value):
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def extract_features(events) -> dict[str, float]:
    c = Counter()
    for e in events:
        try:
            event_id = int(e.event_id or 0)
        except (TypeError, ValueError, OverflowError):
            continue
        for feature in EVENT_FEATURES.get(event_id, ()):
            c[feature] += 1
    return {name: float(c[name]) for name in FEATURES}


def _hour_start(ts: datetime) -> datetime:
    ts = _as_utc(ts)
    return ts.replace(minute=0, second=0, microsecond=0)


def _aggregate_hourly(events) -> list[dict[str, Any]]:
    buckets: dict[tuple[str, str, datetime], dict[str, Any]] = {}
    for e in events:
        user = str(e.username or "")
        host = str(e.computer or "")
        if not user and not host:
            continue
        hour = _hour_start(e.timestamp)
        key = (user, host, hour)
        row = buckets.setdefault(key, {
            "user": user, "host": host, "hour": hour,
            **{f: 0.0 for f in FEATURES},
            "event_ids": [],
        })
        try:
            event_id = int(e.event_id or 0)
        except (TypeError, ValueError, OverflowError):
            event_id = 0
        for feature in EVENT_FEATURES.get(event_id, ()):
            row[feature] += 1.0
        row["event_ids"].append(e.id)
    return sorted(buckets.values(), key=lambda x: (x["user"], x["host"], x["hour"]))


def _transform_consecutive(previous: dict[str, Any], current: dict[str, Any], scales: dict[str, Any]) -> dict[str, float]:
    values = {}
    for f in FEATURES:
        delta = float(current[f]) - float(previous[f])
        signed_log = (1.0 if delta > 0 else -1.0 if delta < 0 else 0.0) * __import__("math").log1p(abs(delta))
        scale = float(scales[f])
        if not scale > 0:
            raise ValueError(f"Invalid saved scale for {f}")
        values[f] = max(-5.0, min(5.0, signed_log / scale))
    return values


def infer_for_entity(db, username: str | None, computer_name: str | None,
                     reference_time: datetime | None = None, window_minutes: int | None = None):
    model, cfg = load_model()
    if model is None:
        return {"ran": False, "reason": _load_error or "ML model unavailable"}

    from app.db.models import Event, Computer
    end = _as_utc(reference_time)
    window = max(int(window_minutes or settings.ML_WINDOW_MINUTES), 120)
    # We need the previous hourly bucket plus the current bucket to reproduce the
    # notebook's consecutive-hour transformation.
    start = end - timedelta(hours=max(2, (window + 59) // 60))
    q = db.query(Event).filter(Event.timestamp >= start, Event.timestamp <= end)
    if username:
        q = q.filter(Event.username == username)
    if computer_name:
        q = q.join(Computer).filter(Computer.hostname == computer_name)
    events = q.order_by(Event.timestamp.asc(), Event.id.asc()).all()
    rows = _aggregate_hourly(events)
    if len(rows) < 2:
        return {"ran": False, "reason": "Insufficient hourly behavioral history"}

    current_hour = _hour_start(end)
    candidates = [r for r in rows if r["hour"] <= current_hour]
    if not candidates:
        return {"ran": False, "reason": "No behavioral-window events available"}
    current = candidates[-1]
    previous_candidates = [r for r in candidates[:-1]
                           if r["user"] == current["user"] and r["host"] == current["host"]]
    if not previous_candidates:
        return {"ran": False, "reason": "No previous user/host hour available"}
    previous = previous_candidates[-1]
    if current["hour"] - previous["hour"] != timedelta(hours=1):
        return {"ran": False, "reason": "Previous user/host hour is not consecutive"}

    import pandas as pd
    import numpy as np
    features = _transform_consecutive(previous, current, cfg["scales"])
    vector = pd.DataFrame([[features[name] for name in FEATURES]], columns=FEATURES).astype("float64")
    try:
        raw_decision = float(model.decision_function(vector)[0])
        anomaly_score = float(-raw_decision)
    except Exception as exc:
        return {"ran": False, "reason": f"Inference failed: {exc}"}

    thresholds = cfg.get("thresholds", {})
    threshold = float(thresholds.get("model_score_p99", float("inf")))
    p995 = float(thresholds.get("model_score_p995", float("inf")))
    predicted_class = "anomaly" if anomaly_score >= threshold else "normal"

    increase_score = float(np.mean(np.maximum(vector.iloc[0].to_numpy(dtype=float), 0.0)))
    decrease_score = float(np.mean(np.maximum(-vector.iloc[0].to_numpy(dtype=float), 0.0)))
    evidence_ids = list(dict.fromkeys((previous.get("event_ids") or []) + (current.get("event_ids") or [])))
    return {
        "ran": True,
        "predicted_class": predicted_class,
        "prediction_label": -1 if predicted_class == "anomaly" else 1,
        "raw_decision_score": raw_decision,
        "anomaly_score": anomaly_score,
        "risk_score": min(100.0, max(0.0, anomaly_score / max(p995, 1e-9) * 100.0)) if anomaly_score > 0 else 0.0,
        "features": features,
        "event_ids": evidence_ids,
        "window_start": previous["hour"].isoformat(),
        "window_end": current["hour"].isoformat(),
        "model_version": "v25",
        "threshold": threshold,
        "threshold_p995": p995,
        "increase_score": increase_score,
        "decrease_score": decrease_score,
        "score_meaning": "Isolation Forest anomaly score = -decision_function; higher is more anomalous, not attack probability.",
        "policy_risk_meaning": "Risk score is a normalized presentation score derived from the saved p99/p995 calibration threshold; it is not model confidence or attack probability.",
        "mapping_note": "Feature transform matches the supplied v25 notebook. Event-ID mapping remains a compatibility assumption because the authoritative collector mapping was not supplied.",
    }
