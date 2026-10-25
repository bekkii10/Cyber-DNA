from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import IncidentResponse, IncidentStatusUpdate
from app.db.database import get_db
from app.db.models import Incident

router = APIRouter()


def _serialize_incident(incident: Incident) -> dict:
    """Build the timeline and affected entities from the persisted linked alerts/events."""
    alerts = sorted(incident.alerts, key=lambda a: (a.time is None, a.time, a.id))
    event_by_id = {}
    for alert in alerts:
        for event in alert.events:
            event_by_id[event.id] = event
    events = sorted(event_by_id.values(), key=lambda e: (e.timestamp is None, e.timestamp, e.id))
    users = sorted({value for value in [*(a.user for a in alerts), *(e.username for e in events)] if value})
    hosts = sorted({value for value in [*(a.host for a in alerts), *(e.computer for e in events)] if value})
    related_alerts = [{
        "id": a.id, "severity": a.severity, "rule": a.rule, "rule_id": a.rule_id,
        "score": a.score, "user": a.user, "host": a.host, "ip": a.ip,
        "time": a.time.isoformat() if a.time else None, "detail": a.detail,
        "source": a.source, "explanation": a.explanation, "status": a.status,
    } for a in alerts]
    related_events = [{
        "id": e.id, "eventId": e.event_id,
        "desc": e.action or e.result or f"Windows event {e.event_id}",
        "ts": e.timestamp.isoformat() if e.timestamp else None,
        "username": e.username, "host": e.computer, "sourceIp": e.source_ip,
    } for e in events]
    chain = [{"t": e["ts"], "text": f"Event {e['eventId']} — {e['desc']}" +
             (f" · user {e['username']}" if e["username"] else "") +
             (f" · host {e['host']}" if e["host"] else "")}
             for e in related_events]
    return {
        "id": incident.id, "title": incident.title, "risk": incident.risk, "score": incident.score,
        "status": incident.status, "first_seen": incident.first_seen, "last_seen": incident.last_seen,
        "users": users, "hosts": hosts, "chain": chain,
        "related_alerts": related_alerts, "related_events": related_events,
    }


@router.get("/incidents", response_model=List[IncidentResponse])
def get_incidents(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    risk: Optional[str] = None,
    db: Session = Depends(get_db)
):
    page = max(1, page)
    limit = max(1, min(200, limit))
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if risk:
        query = query.filter(Incident.risk == risk)
    incidents = query.order_by(Incident.created_at.desc(), Incident.id.asc()).offset((page - 1) * limit).limit(limit).all()
    return [_serialize_incident(i) for i in incidents]


@router.get("/incidents/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _serialize_incident(incident)


@router.patch("/incidents/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(incident_id: str, payload: IncidentStatusUpdate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = payload.status
    db.commit()
    db.refresh(incident)
    return _serialize_incident(incident)
