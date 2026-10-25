from types import SimpleNamespace

from app.core import config
from app.schemas import AnalystRequest
from app.services.analyst import ask, provider_status, retrieve_context
from app.tests.test_integrated_pipeline import db, add
from app.db.models import Alert


def test_provider_status_reports_missing_key(monkeypatch):
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    status = provider_status(check_connectivity=True)
    assert status["configured"] is False
    assert status["status"] == "not_configured"
    assert status["connectivity_checked"] is False


def test_analyst_sends_question_and_retrieved_evidence_to_provider(monkeypatch):
    s = db()
    event = add(s, 4756, user="admin", host="DC1")
    alert = Alert(id="ALT-TEST-1", rule_id="RULE-PRIVILEGED-GROUP-CHANGE",
                  severity="high", score=75, user="admin", host="DC1",
                  time=event.timestamp, detail="Group membership changed",
                  source=f"event:{event.id}", explanation="Event 4756",
                  seen=False, status="new", events=[event])
    s.add(alert); s.commit()

    captured = {}
    class FakeResponses:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(output_text="The stored event records a group membership change. Verify the target group and initiating account.")
    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured["client_options"] = kwargs
            self.responses = FakeResponses()
    monkeypatch.setitem(__import__("sys").modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(config.settings, "AI_MODEL", "gpt-6-luna")

    request = AnalystRequest(message="Why did this alert trigger?",
                             context={"selection": {"type": "alert", "id": "ALT-TEST-1"}})
    result = ask(s, request)
    assert result["provider_status"] == "connected"
    assert result["reply"].startswith("The stored event records")
    assert "Why did this alert trigger?" in captured["input"][-1]["content"]
    assert "ALT-TEST-1" in captured["input"][-1]["content"]
    assert "4756" in captured["input"][-1]["content"]
    assert captured["model"] == "gpt-6-luna"


def test_provider_status_reports_live_connectivity_failure_without_secret(monkeypatch):
    class FakeResponses:
        def create(self, **kwargs):
            raise Exception("do not expose secret test-key-not-real")
    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.responses = FakeResponses()
    monkeypatch.setitem(__import__("sys").modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    result = provider_status(check_connectivity=True)
    assert result["status"] == "error"
    assert result["connectivity_checked"] is True
    assert "test-key-not-real" not in result["message"]


def test_general_analyst_retrieval_includes_database_users_incidents_ml_and_auth_events():
    from datetime import datetime, timezone
    from app.db.models import User, Incident, DetectionFinding
    s = db()
    event = add(s, 4625, user="suspicious.user", host="DC1")
    s.add(User(username="suspicious.user", risk_score=82, status="Active", department="IT"))
    incident = Incident(id="INC-REAL-1", title="Repeated authentication failures", risk="high", score=82,
                        status="OPEN", first_seen=event.timestamp, last_seen=event.timestamp)
    s.add(incident)
    s.add(DetectionFinding(finding_key="ml:test-entity:2026-10-23T12:00", engine_type="ml",
                           detection_name="Test persisted finding", entity_type="user/host",
                           entity_id="suspicious.user|DC1", score=80, predicted_class="anomaly",
                           model_version="v25", evidence={"raw_decision_score": -0.1},
                           feature_values={"failed_logons": 4}, reasons=["Stored test finding"], timestamp=event.timestamp))
    s.commit()

    result = retrieve_context(s, None, "Are there suspicious authentication patterns?")
    assert any(x["id"] == event.id and x["event_id"] == 4625 for x in result["authentication_events"])
    assert any(x["username"] == "suspicious.user" and x["risk_score"] == 82 for x in result["users_by_risk"])
    assert any(x["id"] == "INC-REAL-1" for x in result["recent_incidents"])
    assert any(x["predicted_class"] == "anomaly" for x in result["recent_ml_findings"])


def test_selected_alert_retrieves_neighboring_timeline_events():
    s = db()
    selected = add(s, 4756, user="admin", host="DC1")
    neighbor = add(s, 4624, user="admin", host="DC1", minutes=1)
    alert = Alert(id="ALT-TIMELINE-1", rule_id="RULE-PRIVILEGED-GROUP-CHANGE",
                  severity="high", score=75, user="admin", host="DC1", time=selected.timestamp,
                  detail="Group membership changed", source=f"event:{selected.id}",
                  explanation="Stored explanation", seen=False, status="new", events=[selected])
    s.add(alert); s.commit()
    result = retrieve_context(s, {"selection": {"type": "alert", "id": alert.id, "fake_detail": "pretend this is evidence"}}, "What happened before and after?")
    timeline_ids = {e["id"] for e in result["nearby_timeline_events"]}
    assert selected.id in timeline_ids
    assert neighbor.id in timeline_ids
    assert "fake_detail" not in result["query_context"]["selection"]


def test_missing_selected_record_is_explicit_in_deterministic_fallback(monkeypatch):
    s = db()
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    result = ask(s, AnalystRequest(message="Why did this alert trigger?",
                                  context={"selection": {"type": "alert", "id": "ALT-NOT-IN-DB"}}))
    assert result["configured"] is False
    assert "was not found in the database" in result["reply"]
    assert result["sources"] == []


def test_provider_failure_is_not_returned_as_successful_answer(monkeypatch):
    class AuthenticationError(Exception):
        status_code = 401
    class FakeResponses:
        def create(self, **kwargs):
            raise AuthenticationError("private key detail must not leak")
    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.responses = FakeResponses()
    monkeypatch.setitem(__import__("sys").modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    result = ask(db(), AnalystRequest(message="Summarize the available evidence"))
    assert result["configured"] is True
    assert result["provider_status"] == "error"
    assert result["error_code"] == "invalid_api_key"
    assert result["reply"] == ""
    assert "test-key-not-real" not in str(result)


def test_selected_host_event_and_rule_context_resolve_database_records():
    from app.db.models import DetectionRule
    s = db()
    event = add(s, 4625, user="analyst-test", host="HOST-CTX")
    rule = s.query(DetectionRule).filter_by(id="RULE-FAILED-LOGON-BURST").first()
    alert = Alert(id="ALT-CTX-1", rule_id=rule.id, severity="high", score=75, user="analyst-test",
                  host="HOST-CTX", time=event.timestamp, detail="Failed logon", source=f"event:{event.id}",
                  explanation="Stored rule explanation", seen=False, status="new", events=[event])
    s.add(alert); s.commit()

    event_data = retrieve_context(s, {"selection": {"type": "event", "id": str(event.id), "fake_description": "untrusted"}}, "Explain this event")
    assert event_data["selected_event"]["id"] == event.id
    assert event_data["selected_event_alerts"][0]["id"] == alert.id
    assert "fake_description" not in event_data["query_context"]["selection"]

    host_data = retrieve_context(s, {"selection": {"type": "host", "hostname": "HOST-CTX", "riskScore": 999}}, "Explain this host")
    assert host_data["selected_host"]["hostname"] == "HOST-CTX"
    assert any(e["id"] == event.id for e in host_data["host_recent_events"])
    assert any(a["id"] == alert.id for a in host_data["host_alerts"])

    rule_data = retrieve_context(s, {"selection": {"type": "rule", "id": rule.id}}, "Explain this rule")
    assert rule_data["selected_rule"]["id"] == rule.id
    assert any(a["id"] == alert.id for a in rule_data["rule_alerts"])


def test_general_analyst_retrieval_aggregates_auth_activity_and_sources_all_categories():
    from datetime import datetime, timezone
    from app.db.models import User, Incident, DetectionFinding
    from app.services.analyst import _evidence_records

    s = db()
    failed_1 = add(s, 4625, user="suspect-account", host="DC1", minutes=2)
    failed_2 = add(s, 4625, user="suspect-account", host="DC1", minutes=1)
    success = add(s, 4624, user="suspect-account", host="DC1")
    s.add(User(username="suspect-account", risk_score=87, status="Active", department="IT"))
    incident = Incident(id="INC-EVIDENCE-42", title="Authentication anomaly", risk="high", score=87,
                        status="OPEN", first_seen=failed_1.timestamp, last_seen=success.timestamp)
    s.add(incident)
    alert = Alert(id="ALT-EVIDENCE-42", rule_id="RULE-FAILED-LOGON-BURST", incident_id=incident.id,
                  severity="high", score=87, user="suspect-account", host="DC1", time=success.timestamp,
                  detail="Persisted failed logon burst", source=f"event:{failed_1.id}",
                  explanation="Stored rule alert", seen=False, status="new", events=[failed_1, failed_2, success])
    s.add(alert)
    s.add(DetectionFinding(finding_key="ml:evidence-42", engine_type="ml", detection_name="Persisted anomaly",
                           entity_type="user/host", entity_id="suspect-account|DC1", score=80,
                           predicted_class="anomaly", model_version="v25",
                           evidence={"raw_decision_score": -0.08, "event_ids": [failed_1.id, failed_2.id, success.id]},
                           feature_values={"failed_logons": 2, "successful_logons": 1},
                           reasons=["Stored finding only"], timestamp=success.timestamp))
    s.commit()

    data = retrieve_context(s, None, "Which users have the most suspicious authentication activity?")
    auth_summary = next(row for row in data["authentication_activity_by_user_24h"] if row["username"] == "suspect-account")
    user_summary = next(row for row in data["users_by_risk"] if row["username"] == "suspect-account")
    assert auth_summary["failed_logons_24h"] == 2
    assert auth_summary["successful_logons_24h"] == 1
    assert user_summary["risk_score"] == 87
    assert user_summary["persisted_alert_count"] == 1
    assert user_summary["persisted_ml_finding_count"] == 1
    assert any(a["id"] == alert.id for a in data["recent_alerts"])
    assert any(i["id"] == incident.id for i in data["recent_incidents"])
    assert any(f["detection_name"] == "Persisted anomaly" for f in data["recent_ml_findings"])
    _, sources = _evidence_records(data)
    assert {("alert", alert.id), ("incident", incident.id), ("user", "suspect-account"), ("finding", 1)}.issubset(
        {(source["type"], source["id"]) for source in sources}
    )


def test_empty_general_analyst_retrieval_is_explicit_and_contains_no_fabricated_records():
    from app.services.analyst import _evidence_records
    s = db()
    data = retrieve_context(s, None, "Are there suspicious authentication patterns?")
    evidence, sources = _evidence_records(data)
    assert evidence == []
    assert sources == []
    assert data["retrieval_counts"] == {
        "alerts": 0, "events": 0, "incidents": 0, "users": 0,
        "ml_findings": 0, "authentication_events": 0, "authentication_users_24h": 0,
    }
    assert data["authentication_activity_by_user_24h"] == []


def test_live_analyst_prompt_contains_retrieved_aggregate_evidence(monkeypatch):
    from datetime import datetime, timezone
    from app.db.models import User
    s = db()
    event = add(s, 4625, user="db-backed-user", host="DC-REAL")
    s.add(User(username="db-backed-user", risk_score=91, status="Active", department="Security"))
    s.commit()
    captured = {}

    class FakeResponses:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(output_text="Database evidence lists db-backed-user with a stored risk score of 91 and a failed logon event. This does not prove compromise.")
    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured["client_options"] = kwargs
            self.responses = FakeResponses()
    monkeypatch.setitem(__import__("sys").modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))
    monkeypatch.setattr(config.settings, "OPENAI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    result = ask(s, AnalystRequest(message="Which users have suspicious activity?"))
    prompt = captured["input"][-1]["content"]
    assert result["provider_status"] == "connected"
    assert "db-backed-user" in prompt
    assert "failed_logons_24h" in prompt
    assert str(event.id) in prompt
    assert "test-key-not-real" not in str(result)
