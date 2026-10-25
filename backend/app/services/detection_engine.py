"""Deterministic Windows Active Directory detection rules. No machine learning."""
from __future__ import annotations

from collections import defaultdict
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.db.models import Alert, DetectionRule, Event

# Starter thresholds. Review these against normal activity in the target AD lab.
BRUTE_FORCE_THRESHOLD = 5
BRUTE_FORCE_WINDOW_MINUTES = 5
PASSWORD_SPRAY_MIN_ACCOUNTS = 5
PASSWORD_SPRAY_WINDOW_MINUTES = 10

RULE_DEFINITIONS = (
    {
        "id": "RULE-FAILED-LOGON-BURST",
        "name": "Repeated failed logons (possible brute force)",
        "type": "threshold",
        "severity": "high",
        "logic": f"At least {BRUTE_FORCE_THRESHOLD} event 4625 records for one account and source/host in {BRUTE_FORCE_WINDOW_MINUTES} minutes",
    },
    {
        "id": "RULE-PASSWORD-SPRAY",
        "name": "Possible password spraying",
        "type": "threshold",
        "severity": "high",
        "logic": f"Failed logons from one source against at least {PASSWORD_SPRAY_MIN_ACCOUNTS} distinct accounts in {PASSWORD_SPRAY_WINDOW_MINUTES} minutes",
    },
    {
        "id": "RULE-LOG-CLEARED",
        "name": "Security audit log cleared",
        "type": "event_id",
        "severity": "critical",
        "logic": "Windows Security event 1102",
    },
    {
        "id": "RULE-USER-CREATED",
        "name": "Active Directory user created",
        "type": "event_id",
        "severity": "medium",
        "logic": "Windows Security event 4720; validate whether the account creation was authorized",
    },
    {
        "id": "RULE-PRIVILEGED-GROUP-CHANGE",
        "name": "Privileged group membership changed",
        "type": "event_id",
        "severity": "high",
        "logic": "Windows Security events 4728, 4732, or 4756; confirm group and member details from event data",
    },
)

STATIC_EVENT_RULES = {
    1102: "RULE-LOG-CLEARED",
    4720: "RULE-USER-CREATED",
    4728: "RULE-PRIVILEGED-GROUP-CHANGE",
    4732: "RULE-PRIVILEGED-GROUP-CHANGE",
    4756: "RULE-PRIVILEGED-GROUP-CHANGE",
}


def ensure_detection_rules(db: Session) -> None:
    """Insert missing rule definitions without overwriting user enable/disable choices."""
    for definition in RULE_DEFINITIONS:
        rule = db.get(DetectionRule, definition["id"])
        if rule is None:
            db.add(DetectionRule(**definition, enabled=True, alert_count=0))
    db.flush()


def _as_utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _enabled(db: Session, rule_id: str) -> DetectionRule | None:
    rule = db.get(DetectionRule, rule_id)
    return rule if rule is not None and rule.enabled else None


def _valid_value(value: str | None) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    if not value or value in {"-", "::", "0.0.0.0", "::1"}:
        return None
    return value


def _is_security_channel(event: Event) -> bool:
    """Accept legacy events with no channel, but reject explicitly non-Security records."""
    channel = _valid_value(event.channel)
    return channel is None or channel.casefold() == "security"


def _create_or_update_alert(
    db: Session,
    *,
    rule: DetectionRule,
    fingerprint: str,
    evidence: Iterable[Event],
    severity: str,
    score: float,
    user: str | None,
    host: str | None,
    ip: str | None,
    detail: str,
    explanation: str,
    dedupe_minutes: int = 0,
) -> bool:
    evidence = list({event.id: event for event in evidence}.values())
    if not evidence:
        return False
    evidence.sort(key=lambda event: (_as_utc(event.timestamp), event.id))
    latest = evidence[-1]
    latest_time = _as_utc(latest.timestamp)

    existing = None
    if dedupe_minutes > 0:
        cutoff = latest_time - timedelta(minutes=dedupe_minutes)
        existing = (
            db.query(Alert)
            .filter(
                Alert.rule_id == rule.id,
                Alert.source == fingerprint,
                Alert.time >= cutoff,
            )
            .order_by(Alert.time.desc())
            .first()
        )
    else:
        existing = (
            db.query(Alert)
            .filter(Alert.rule_id == rule.id, Alert.source == fingerprint)
            .first()
        )

    if existing:
        known_ids = {event.id for event in existing.events}
        existing.events.extend(event for event in evidence if event.id not in known_ids)
        existing.time = latest_time
        existing.detail = detail
        existing.explanation = explanation
        # Keep severity at least as strong as the rule's configured severity.
        existing.severity = severity
        db.flush()
        return False

    alert = Alert(
        id=f"ALT-{rule.id}-{latest.id}",
        rule_id=rule.id,
        severity=severity,
        score=score,
        user=user,
        host=host,
        ip=ip,
        time=latest_time,
        detail=detail,
        source=fingerprint,
        explanation=explanation,
        seen=False,
        status="new",
        events=evidence,
    )
    db.add(alert)
    rule.alert_count = (rule.alert_count or 0) + 1
    db.flush()
    return True


def _detect_static_events(db: Session, events: list[Event]) -> int:
    created = 0
    for event in events:
        # These event IDs are meaningful for these rules in the Windows Security log.
        if not _is_security_channel(event):
            continue
        rule_id = STATIC_EVENT_RULES.get(event.event_id)
        if not rule_id:
            continue
        rule = _enabled(db, rule_id)
        if not rule:
            continue

        if event.event_id == 1102:
            severity, score = "critical", 100.0
            detail = "The Windows Security audit log was cleared (event 1102)."
            explanation = "Event 1102 records that the Security audit log was cleared. This is important to investigate; it does not by itself prove who cleared it or why."
        elif event.event_id == 4720:
            severity, score = "medium", 55.0
            detail = "An Active Directory user account was created (event 4720)."
            explanation = "Event 4720 indicates account creation. Confirm the target account and whether the change was approved using the event details."
        else:
            severity, score = "high", 75.0
            detail = f"A security group membership change was recorded (event {event.event_id})."
            explanation = "This event ID records a group membership change. Inspect the group, added member, and initiating account in the event details to confirm whether it affected privileged access."

        created += _create_or_update_alert(
            db,
            rule=rule,
            fingerprint=f"event:{event.id}",
            evidence=[event],
            severity=severity,
            score=score,
            user=_valid_value(event.username),
            host=_valid_value(event.computer),
            ip=_valid_value(event.source_ip),
            detail=detail,
            explanation=explanation,
        )
    return created


def run_rule_detection(db: Session, reference_time: datetime | None = None, lookback_minutes: int = 10) -> dict:
    """Run enabled rules against a recent event window and persist alerts with evidence."""
    ensure_detection_rules(db)
    end = _as_utc(reference_time)
    start = end - timedelta(minutes=max(lookback_minutes, PASSWORD_SPRAY_WINDOW_MINUTES))
    events = (
        db.query(Event)
        .filter(Event.timestamp >= start, Event.timestamp <= end)
        .order_by(Event.timestamp.asc(), Event.id.asc())
        .all()
    )

    created = _detect_static_events(db, events)
    failure_events = [event for event in events
                      if event.event_id == 4625 and _valid_value(event.username)
                      and _is_security_channel(event)]

    brute_rule = _enabled(db, "RULE-FAILED-LOGON-BURST")
    if brute_rule:
        cutoff = end - timedelta(minutes=BRUTE_FORCE_WINDOW_MINUTES)
        groups: dict[tuple[str, str, str], list[Event]] = defaultdict(list)
        for event in failure_events:
            if _as_utc(event.timestamp) < cutoff:
                continue
            username = _valid_value(event.username)
            source_ip = _valid_value(event.source_ip)
            host = _valid_value(event.computer)
            # Without either source or host, separate events cannot reliably be
            # attributed to one origin. Do not combine unrelated failures into a
            # brute-force alert merely because both fields are missing.
            if not source_ip and not host:
                continue
            ip = source_ip or "unknown-source"
            host = host or "unknown-host"
            groups[(username, ip, host)].append(event)
        for (username, ip_key, host_key), matched in groups.items():
            if len(matched) < BRUTE_FORCE_THRESHOLD:
                continue
            ip = None if ip_key == "unknown-source" else ip_key
            host = None if host_key == "unknown-host" else host_key
            created += _create_or_update_alert(
                db,
                rule=brute_rule,
                fingerprint=f"account:{username}|source:{ip_key}|host:{host_key}",
                evidence=matched,
                severity="high",
                score=80.0,
                user=username,
                host=host,
                ip=ip,
                detail=f"{len(matched)} failed logons for account {username} within {BRUTE_FORCE_WINDOW_MINUTES} minutes.",
                explanation=(f"Rule matched {len(matched)} Windows event 4625 records for the same account and source/host "
                            f"within {BRUTE_FORCE_WINDOW_MINUTES} minutes. This is a brute-force-like pattern; validate the source and account context."),
                dedupe_minutes=BRUTE_FORCE_WINDOW_MINUTES,
            )

    spray_rule = _enabled(db, "RULE-PASSWORD-SPRAY")
    if spray_rule:
        cutoff = end - timedelta(minutes=PASSWORD_SPRAY_WINDOW_MINUTES)
        groups_by_ip: dict[str, list[Event]] = defaultdict(list)
        for event in failure_events:
            if _as_utc(event.timestamp) < cutoff:
                continue
            ip = _valid_value(event.source_ip)
            if ip:
                groups_by_ip[ip].append(event)
        for ip, matched in groups_by_ip.items():
            accounts = sorted({_valid_value(event.username) for event in matched if _valid_value(event.username)})
            if len(accounts) < PASSWORD_SPRAY_MIN_ACCOUNTS:
                continue
            created += _create_or_update_alert(
                db,
                rule=spray_rule,
                fingerprint=f"source:{ip}",
                evidence=matched,
                severity="high",
                score=80.0,
                user=f"Multiple accounts ({len(accounts)})",
                host=None,
                ip=ip,
                detail=(f"Failed logons from {ip} targeted {len(accounts)} distinct accounts "
                        f"within {PASSWORD_SPRAY_WINDOW_MINUTES} minutes."),
                explanation=(f"Rule matched failed-logon event 4625 records from one source against "
                            f"{len(accounts)} distinct accounts in {PASSWORD_SPRAY_WINDOW_MINUTES} minutes. "
                            "This is a password-spraying-like pattern; verify whether the source is legitimate."),
                dedupe_minutes=PASSWORD_SPRAY_WINDOW_MINUTES,
            )

    db.commit()
    return {
        "status": "completed",
        "events_examined": len(events),
        "alerts_created": created,
        "method": "rule_based",
        "ml_used": False,
        "rules_enabled": db.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).count(),
    }


def run_detection_for_event(db: Session, event: Event) -> dict:
    """Evaluate recent activity whenever a new event is ingested."""
    return run_detection(db, reference_time=event.timestamp, lookback_minutes=PASSWORD_SPRAY_WINDOW_MINUTES)


def _run_ml_layer(db: Session, reference_time: datetime | None = None, lookback_minutes: int = 60) -> dict:
    from app.services.ml_detection import infer_for_entity, status as ml_status
    from app.db.models import DetectionFinding
    end = _as_utc(reference_time)
    start = end - timedelta(minutes=lookback_minutes)
    events = (db.query(Event)
              .filter(Event.timestamp >= start, Event.timestamp <= end)
              .order_by(Event.timestamp.asc(), Event.id.asc()).all())
    entities = {(e.username, e.computer) for e in events if _valid_value(e.username) or _valid_value(e.computer)}
    findings = 0
    alerts = 0
    failed = []
    for username, host in entities:
        result = infer_for_entity(db, _valid_value(username), _valid_value(host), end, lookback_minutes)
        if not result.get("ran"):
            if result.get("reason") not in (None, "No behavioral-window events available"):
                failed.append(result["reason"])
            continue
        findings += 1
        entity_id = f"{username or '*'}|{host or '*'}"
        finding_key = f"ml:{entity_id}:{result['window_end'][:16]}"
        existing_finding = db.query(DetectionFinding).filter_by(finding_key=finding_key).first()
        if not existing_finding:
            db.add(DetectionFinding(
                finding_key=finding_key, engine_type="ml",
                detection_name="Cyber DNA v25 behavioral anomaly",
                entity_type="user/host", entity_id=entity_id,
                score=result["risk_score"], predicted_class=result["predicted_class"],
                model_version=result["model_version"], evidence={"event_ids": result["event_ids"],
                "window_start": result["window_start"], "window_end": result["window_end"],
                "raw_decision_score": result["raw_decision_score"],
                "policy_risk_score": result["risk_score"],
                "score_meaning": result["score_meaning"]},
                feature_values=result["features"],
                reasons=[f"Model classification: {result['predicted_class']} using the saved v25 calibration threshold.",
                         f"Anomaly score={result['anomaly_score']:.6f}; raw Isolation Forest decision score={result['raw_decision_score']:.6f}.",
                         f"Saved p99 anomaly threshold={result['threshold']:.6f}; p995={result['threshold_p995']:.6f}.",
                         f"Cyber DNA presentation risk score={result['risk_score']:.1f}; this is not attack probability or confidence.",
                         result["mapping_note"]],
                timestamp=end))
        # Alert only on model anomaly; normal predictions are preserved as findings.
        if result["predicted_class"] != "anomaly":
            continue
        alert = db.query(Alert).filter(Alert.rule_id.is_(None), Alert.source == f"ml:{entity_id}").order_by(Alert.time.desc()).first()
        evidence = [e for e in events if e.id in set(result["event_ids"])]
        if alert and alert.time and (_as_utc(alert.time) >= end - timedelta(minutes=lookback_minutes)):
            alert.time = end
            alert.score = result["risk_score"]
            alert.detail = f"Behavioral anomaly for {username or host}; model predicted anomaly."
            alert.explanation = (
                f"Cyber DNA v25 Isolation Forest anomaly score={result['anomaly_score']:.6f} exceeded the saved p99 calibration threshold "
                f"{result['threshold']:.6f} for a consecutive user/host hourly behavioral change. "
                f"Raw decision score={result['raw_decision_score']:.6f}; presentation risk score={result['risk_score']:.1f}. "
                "Neither score is attack probability. Transformed features: " +
                ", ".join(f"{k}={v:g}" for k, v in result["features"].items() if v))
            known = {e.id for e in alert.events}
            alert.events.extend(e for e in evidence if e.id not in known)
            continue
        stable_entity = hashlib.sha256(entity_id.encode("utf-8")).hexdigest()[:16]
        alert_id = f"ALT-ML-{stable_entity}-{max((e.id for e in evidence), default=0)}"
        alert = Alert(id=alert_id, rule_id=None, severity="high",
                      score=result["risk_score"], user=username, host=host, time=end,
                      detail=f"Behavioral anomaly for {username or host}; model predicted anomaly.",
                      source=f"ml:{entity_id}",
                      explanation=(
                          f"Cyber DNA v25 Isolation Forest predicted anomaly for the {lookback_minutes}-minute behavioral window. "
                          f"Raw decision score={result['raw_decision_score']:.6f}; policy risk score={result['risk_score']:.1f}. "
                          "This is not attack probability. Features: " +
                          ", ".join(f"{k}={v:g}" for k, v in result["features"].items() if v)),
                      seen=False, status="new", events=evidence)
        db.add(alert); db.flush()
        alerts += 1
        finding = db.query(DetectionFinding).filter_by(finding_key=finding_key).first()
        if finding:
            finding.alert_id = alert.id
    db.commit()
    return {"available": ml_status()["available"], "findings": findings, "alerts_created": alerts, "errors": failed}


def run_detection(db: Session, reference_time: datetime | None = None, lookback_minutes: int = 10) -> dict:
    """Integrated pipeline: rules -> ML -> correlation. Rule failures never suppress ML, and ML failures never suppress rules."""
    rule_result = run_rule_detection(db, reference_time=reference_time, lookback_minutes=lookback_minutes)
    ml_result = _run_ml_layer(db, reference_time=reference_time, lookback_minutes=max(lookback_minutes, 120))
    from app.services.correlation import correlate_recent
    correlation = correlate_recent(db, lookback_minutes=15)
    ml_ran = bool(ml_result.get("findings"))
    return {
        **rule_result,
        "method": "rule_and_ml" if ml_ran else "rule_only",
        "ml_used": ml_ran,
        "ml": ml_result,
        "correlation": correlation,
        "rule_alerts_created": rule_result["alerts_created"],
    }
