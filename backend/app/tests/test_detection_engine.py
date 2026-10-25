from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.db.models import Alert, Computer, DetectionRule, Event
from app.services.detection_engine import ensure_detection_rules, run_detection


def make_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def add_event(db, event_id, minute_offset, username="alice", source_ip="192.0.2.10", host="DC-LAB"):
    host_row = db.query(Computer).filter_by(hostname=host).first()
    if host_row is None:
        host_row = Computer(hostname=host, status="online")
        db.add(host_row)
        db.flush()
    event = Event(
        timestamp=datetime.now(timezone.utc) + timedelta(minutes=minute_offset),
        event_id=event_id,
        username=username,
        source_ip=source_ip,
        computer_id=host_row.id,
        record_id=1000 + minute_offset,
        event_details={},
    )
    db.add(event)
    db.flush()
    return event


def test_repeated_failed_logons_create_evidence_linked_alert():
    db = make_db()
    ensure_detection_rules(db)
    now = datetime.now(timezone.utc)
    # The v25 model requires a consecutive previous hourly profile. Keep the
    # rule burst in the current hour while supplying a real previous-hour baseline.
    previous_hour = (now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
                     + timedelta(minutes=10))
    events = [Event(timestamp=previous_hour, event_id=4624,
                    username="alice", source_ip="192.0.2.10", event_details={})]
    events.extend(
        Event(timestamp=now - timedelta(seconds=30 * i), event_id=4625,
              username="alice", source_ip="192.0.2.10", event_details={})
        for i in range(5)
    )
    db.add_all(events)
    db.commit()

    result = run_detection(db, reference_time=now)
    alert = db.query(Alert).filter_by(rule_id="RULE-FAILED-LOGON-BURST").first()
    assert result["method"] == "rule_and_ml"
    assert result["ml"]["findings"] >= 1
    assert alert is not None
    assert len(alert.events) == 5
    assert "5 failed logons" in alert.detail
    db.close()


def test_password_spray_uses_distinct_accounts():
    db = make_db()
    ensure_detection_rules(db)
    now = datetime.now(timezone.utc)
    db.add_all([
        Event(timestamp=now - timedelta(seconds=i * 10), event_id=4625,
              username=f"user{i}", source_ip="192.0.2.44", event_details={})
        for i in range(5)
    ])
    db.commit()
    run_detection(db, reference_time=now)
    alert = db.query(Alert).filter_by(rule_id="RULE-PASSWORD-SPRAY").first()
    assert alert is not None
    assert alert.ip == "192.0.2.44"
    assert len(alert.events) == 5
    db.close()


def test_audit_log_clear_creates_critical_alert_once():
    db = make_db()
    ensure_detection_rules(db)
    now = datetime.now(timezone.utc)
    event = Event(timestamp=now, event_id=1102, username="admin", source_ip="192.0.2.5", event_details={})
    db.add(event)
    db.commit()
    run_detection(db, reference_time=now)
    run_detection(db, reference_time=now)
    alerts = db.query(Alert).filter_by(rule_id="RULE-LOG-CLEARED").all()
    assert len(alerts) == 1
    assert alerts[0].severity == "critical"
    assert len(alerts[0].events) == 1
    db.close()


def test_disabled_rule_does_not_create_alert():
    db = make_db()
    ensure_detection_rules(db)
    rule = db.get(DetectionRule, "RULE-LOG-CLEARED")
    rule.enabled = False
    now = datetime.now(timezone.utc)
    db.add(Event(timestamp=now, event_id=1102, username="admin", event_details={}))
    db.commit()
    run_detection(db, reference_time=now)
    assert db.query(Alert).filter_by(rule_id="RULE-LOG-CLEARED").count() == 0
    db.close()


def test_collector_ingestion_runs_rules_automatically():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.endpoints.collector import router as collector_router
    from app.services.security import require_collector
    from app.db.database import get_db

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    test_app = FastAPI()
    test_app.include_router(collector_router, prefix="/api/v1")

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    test_app.dependency_overrides[get_db] = override_get_db
    test_app.dependency_overrides[require_collector] = lambda: {"test": True}
    base_time = datetime.now(timezone.utc) - timedelta(seconds=20)
    with TestClient(test_app) as client:
        for i in range(5):
            response = client.post("/api/v1/collector/events", json={
                "timestamp": (base_time + timedelta(seconds=i)).isoformat(),
                "event_id": 4625,
                "username": "alice",
                "source_ip": "192.0.2.10",
                "computer": "DC-LAB",
                "event_details": {},
            })
            assert response.status_code == 201, response.text
            assert response.json()["stored"] is True
            assert response.json()["detection"]["ml_used"] in (True, False)

    db = TestingSession()
    try:
        alert = db.query(Alert).filter_by(rule_id="RULE-FAILED-LOGON-BURST").first()
        assert alert is not None
        assert len(alert.events) == 5
    finally:
        db.close()
        engine.dispose()


def test_failed_logons_without_source_or_host_do_not_create_brute_force_alert():
    db = make_db()
    ensure_detection_rules(db)
    now = datetime.now(timezone.utc)
    db.add_all([
        Event(timestamp=now - timedelta(seconds=20 * i), event_id=4625,
              username="alice", source_ip=None, computer_id=None, event_details={})
        for i in range(5)
    ])
    db.commit()
    run_detection(db, reference_time=now)
    assert db.query(Alert).filter_by(rule_id="RULE-FAILED-LOGON-BURST").count() == 0
    db.close()


def test_security_event_rule_ignores_same_event_id_from_non_security_channel():
    db = make_db()
    ensure_detection_rules(db)
    now = datetime.now(timezone.utc)
    db.add(Event(timestamp=now, event_id=1102, channel="Application",
                 username="admin", event_details={}))
    db.commit()
    run_detection(db, reference_time=now)
    assert db.query(Alert).filter_by(rule_id="RULE-LOG-CLEARED").count() == 0
    db.close()
