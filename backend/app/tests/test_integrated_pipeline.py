
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.db.models import Alert, Computer, DetectionFinding, DetectionRule, Event, Incident
from app.services.detection_engine import ensure_detection_rules, run_detection
from app.services.ml_detection import FEATURES, extract_features, status as ml_status
from app.services.analyst import retrieve_context


def db():
    e = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(e)
    s = sessionmaker(bind=e, autoflush=False, autocommit=False)()
    ensure_detection_rules(s); s.commit()
    return s


def add(s, eid, user="alice", host="DC1", ip="192.0.2.10", minutes=0):
    c = s.query(Computer).filter_by(hostname=host).first()
    if not c:
        c = Computer(hostname=host, status="online"); s.add(c); s.flush()
    e = Event(timestamp=datetime.now(timezone.utc)-timedelta(minutes=minutes),
              event_id=eid, username=user, source_ip=ip, computer_id=c.id, event_details={})
    s.add(e); s.flush(); return e


def test_feature_order_matches_supplied_artifact():
    st = ml_status()
    assert st["feature_names"] == FEATURES
    assert st["model_version"] == "v25"


def test_feature_extraction_is_deterministic():
    s = db()
    for eid in [4624, 4625, 4634, 4648, 4672, 4688, 4768, 4769, 4776]:
        add(s, eid)
    events = s.query(Event).all()
    f = extract_features(events)
    assert list(f) == FEATURES
    assert all(v == 1.0 for v in f.values())
    # Group membership changes contribute to the compatibility adapter's privilege feature.
    assert extract_features([type("E", (), {"event_id": 4756})()])["privilege_events"] == 1.0


def test_ml_only_detection_persists_without_rule_alert():
    s = db()
    # Supply a real previous hourly profile plus a distinct current-hour profile.
    add(s, 4624, user="behavioral", host="WS1", minutes=65)
    for eid in [4624, 4648, 4672, 4688, 4768, 4769, 4776]:
        add(s, eid, user="behavioral", host="WS1", minutes=0)
    now = datetime.now(timezone.utc)
    result = run_detection(s, reference_time=now)
    assert result["ml"]["findings"] >= 1
    # Regardless of whether this particular unsupervised sample crosses the alert
    # threshold, the ML finding itself must be persisted.
    ml_finding = s.query(DetectionFinding).filter_by(engine_type="ml").first()
    assert ml_finding is not None
    assert ml_finding.feature_values["privilege_events"] > 0
    assert "raw_decision_score" in ml_finding.evidence
    assert ml_finding.model_version == "v25"


def test_rule_detection_survives_ml_disable():
    s = db()
    for _ in range(5):
        add(s, 4625, user="ruleuser")
    from app.core import config
    old = config.settings.ML_ENABLED
    config.settings.ML_ENABLED = False
    try:
        result = run_detection(s)
        assert result["rule_alerts_created"] >= 1
        assert s.query(Alert).filter(Alert.rule_id == "RULE-FAILED-LOGON-BURST").count() == 1
    finally:
        config.settings.ML_ENABLED = old


def test_provenance_and_correlation_are_persisted():
    s = db()
    now = datetime.now(timezone.utc)
    for _ in range(5):
        s.add(Event(timestamp=now, event_id=4625, username="both", source_ip="192.0.2.1", event_details={}))
    # A second deterministic detection on the same identity.
    s.add(Event(timestamp=now, event_id=1102, username="both", source_ip="192.0.2.1", event_details={}))
    s.commit()
    result = run_detection(s, reference_time=now)
    assert s.query(Alert).filter(Alert.rule_id == "RULE-FAILED-LOGON-BURST").count() == 1
    assert s.query(Alert).filter(Alert.rule_id == "RULE-LOG-CLEARED").count() == 1
    assert s.query(DetectionFinding).filter_by(engine_type="correlated").count() >= 1
    assert s.query(Incident).count() >= 1
    assert result["correlation"]["status"] == "completed"


def test_analyst_retrieval_is_grounded_in_selected_alert():
    s = db()
    e = add(s, 1102, user="admin")
    a = Alert(id="A1", rule_id="RULE-LOG-CLEARED", severity="critical", score=100,
              user="admin", host="DC1", time=e.timestamp, detail="audit log cleared",
              source="event:1", explanation="event 1102", seen=False, status="new", events=[e])
    s.add(a); s.commit()
    data = retrieve_context(s, {"selection": {"type": "alert", "id": "A1"}}, "why?")
    assert data["selected_alert"]["id"] == "A1"
    assert data["selected_events"][0]["id"] == e.id


def test_model_status_reports_real_artifact_and_mapping_limitations():
    status = ml_status()
    assert status["enabled"] is True
    assert status["available"] is True
    assert status["model"] == "cyberdna_v25_isolation_forest"
    assert status["compatibility"] == "artifact_loaded_exact_v25_transform_mapping_compatibility"
    assert "event-id-to-feature mapping" in status["warning"].lower()
    assert "consecutive user/host hourly deltas" in status["feature_transform"].lower()
    assert "not a probability" in status["score_semantics"].lower()


def test_collector_retries_with_same_windows_record_id_are_idempotent():
    from app.api.endpoints.collector import create_event
    from app.schemas import EventCreate
    s = db()
    payload = EventCreate(
        timestamp=datetime.now(timezone.utc), event_id=4756, username="dedupe-test",
        computer="DEDUP-HOST", channel="Security", provider="Microsoft-Windows-Security-Auditing",
        record_id=987654, event_details={"test": "idempotency"},
    )
    first = create_event(payload, s)
    second = create_event(payload, s)
    assert first["stored"] is True
    assert second.status_code == 200
    assert s.query(Event).filter_by(record_id=987654).count() == 1


def test_malformed_event_id_is_ignored_by_feature_extraction():
    malformed = type("E", (), {"event_id": "not-an-integer"})()
    valid = type("E", (), {"event_id": 4625})()
    features = extract_features([malformed, valid])
    assert features["failed_logons"] == 1.0
    assert features["successful_logons"] == 0.0


def test_api_end_to_end_ingestion_dedup_rule_ml_and_analyst_use_isolated_database(monkeypatch):
    """Exercise real FastAPI route wiring against an in-memory DB, never the developer DB."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.endpoints import collector, events, alerts, detection, analyst, users
    from app.services.security import require_collector
    from app.core import config
    from app.db.database import get_db

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with TestingSession() as session:
        ensure_detection_rules(session)
        session.commit()

    test_app = FastAPI()
    for router in (collector.router, events.router, alerts.router, detection.router, analyst.router, users.router):
        test_app.include_router(router, prefix="/api/v1")

    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    test_app.dependency_overrides[get_db] = override_get_db
    test_app.dependency_overrides[require_collector] = lambda: {"test": True}
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_id": 4756,
        "username": "isolated-test-admin",
        "source_ip": "192.0.2.123",
        "computer": "ISOLATED-DC",
        "channel": "Security",
        "provider": "Microsoft-Windows-Security-Auditing",
        "record_id": 998877,
        "event_details": {"TargetUserName": "isolated-test-admin"},
    }
    try:
        with TestClient(test_app) as client:
            invalid = client.post("/api/v1/collector/events", json={**payload, "event_id": "not-an-integer"})
            assert invalid.status_code == 422
            assert client.get("/api/v1/events").json() == []

            previous = {**payload,
                        "timestamp": (datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
                                      - timedelta(hours=1) + timedelta(minutes=10)).isoformat(),
                        "event_id": 4624, "record_id": 998876}
            previous_response = client.post("/api/v1/collector/events", json=previous)
            assert previous_response.status_code == 201, previous_response.text

            ingested = client.post("/api/v1/collector/events", json=payload)
            assert ingested.status_code == 201, ingested.text
            assert ingested.json()["stored"] is True
            assert ingested.json()["detection"]["status"] == "completed"

            duplicate = client.post("/api/v1/collector/events", json=payload)
            assert duplicate.status_code == 200
            assert duplicate.json()["duplicate"] is True
            stored_events = client.get("/api/v1/events")
            assert stored_events.status_code == 200
            assert len(stored_events.json()) == 2

            stored_alerts = client.get("/api/v1/alerts")
            assert stored_alerts.status_code == 200
            alert = next(a for a in stored_alerts.json() if a.get("rule_id") == "RULE-PRIVILEGED-GROUP-CHANGE")
            user_response = client.get("/api/v1/users")
            assert user_response.status_code == 200, user_response.text
            user_record = next(u for u in user_response.json() if u["username"] == "isolated-test-admin")
            assert user_record["recent_events"][0]["event_id"] == 4756
            assert user_record["last_seen"] is not None
            assert user_record["recent_alerts"][0]["id"] == alert["id"]
            findings = client.get("/api/v1/detection/findings")
            assert findings.status_code == 200
            assert any(f["engine_type"] == "ml" for f in findings.json()["items"])

            response = client.post("/api/v1/analyst/ask", json={
                "message": "Why did this specific alert trigger?",
                "context": {"selection": {"type": "alert", "id": alert["id"]}},
            })
            assert response.status_code == 200, response.text
            body = response.json()
            assert body["configured"] is False
            assert alert["id"] in body["reply"]
            assert any(source["type"] == "alert" and source["id"] == alert["id"] for source in body["sources"])
    finally:
        test_app.dependency_overrides.clear()
        engine.dispose()


def test_incident_and_host_api_responses_include_persisted_linked_data():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.endpoints import incidents, hosts
    from app.db.database import get_db

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    now = datetime.now(timezone.utc)
    with TestingSession() as session:
        host = Computer(hostname="SERIALIZER-DC", ip_address="192.0.2.8", status="online", risk_score=0)
        session.add(host); session.flush()
        event = Event(timestamp=now, event_id=4728, username="actual.admin", source_ip="192.0.2.9",
                      computer_id=host.id, action="Group membership changed", event_details={})
        session.add(event); session.flush()
        alert = Alert(id="ALT-SERIALIZE-1", severity="high", score=75, user="actual.admin", host="SERIALIZER-DC",
                      ip="192.0.2.9", time=now, detail="Group membership changed", source="ml:actual.admin|SERIALIZER-DC",
                      explanation="Stored explanation", seen=False, status="new", events=[event])
        incident = Incident(id="INC-SERIALIZE-1", title="Correlated findings", risk="high", score=75,
                            status="OPEN", first_seen=now, last_seen=now, alerts=[alert])
        session.add(incident); session.commit()

    test_app = FastAPI()
    test_app.include_router(incidents.router, prefix="/api/v1")
    test_app.include_router(hosts.router, prefix="/api/v1")
    def override_get_db():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()
    test_app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(test_app) as client:
            response = client.get("/api/v1/incidents/INC-SERIALIZE-1")
            assert response.status_code == 200, response.text
            body = response.json()
            assert body["users"] == ["actual.admin"]
            assert body["hosts"] == ["SERIALIZER-DC"]
            assert body["related_alerts"][0]["id"] == "ALT-SERIALIZE-1"
            assert body["related_events"][0]["eventId"] == 4728
            assert body["chain"][0]["text"].startswith("Event 4728")

            host_response = client.get("/api/v1/hosts")
            assert host_response.status_code == 200, host_response.text
            host_body = host_response.json()[0]
            assert host_body["ip"] == "192.0.2.8"
            assert host_body["event_count"] == 1
            assert host_body["os"] is None  # OS is not stored by this database schema.
    finally:
        test_app.dependency_overrides.clear()
        engine.dispose()
