
from datetime import datetime, timedelta, timezone
from math import log1p, isfinite

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.db.models import Computer, Event
from app.services.ml_detection import (
    FEATURES, _transform_consecutive, infer_for_entity, load_model, status
)


def make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def test_saved_v25_transform_is_signed_log_scaled_and_clipped():
    cfg = load_model()[1]
    previous = {f: 0.0 for f in FEATURES}
    current = {f: 0.0 for f in FEATURES}
    previous["successful_logons"] = 2.0
    current["successful_logons"] = 5.0
    previous["failed_logons"] = 5.0
    current["failed_logons"] = 1.0
    out = _transform_consecutive(previous, current, cfg["scales"])
    assert out["successful_logons"] == min(5.0, log1p(3.0) / cfg["scales"]["successful_logons"])
    assert out["failed_logons"] < 0
    assert all(isfinite(v) and -5 <= v <= 5 for v in out.values())


def test_model_loads_and_scores_a_real_consecutive_hour_window():
    s = make_db()
    host = Computer(hostname="MODEL-TEST", status="online")
    s.add(host); s.flush()
    now = datetime.now(timezone.utc)
    previous = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1) + timedelta(minutes=10)
    current = now.replace(minute=0, second=0, microsecond=0) + timedelta(minutes=5)
    s.add(Event(timestamp=previous, event_id=4624, username="model-user", computer_id=host.id, event_details={}))
    for eid in (4624, 4648, 4672, 4688, 4768, 4769, 4776):
        s.add(Event(timestamp=current, event_id=eid, username="model-user", computer_id=host.id, event_details={}))
    s.commit()
    result = infer_for_entity(s, "model-user", "MODEL-TEST", current, 120)
    assert result["ran"] is True
    assert result["model_version"] == "v25"
    assert result["score_meaning"].startswith("Isolation Forest anomaly score")
    assert isfinite(result["anomaly_score"])
    assert isfinite(result["raw_decision_score"])
    assert result["threshold"] == status()["threshold_p99"]
    assert set(result["features"]) == set(FEATURES)
    s.close()
