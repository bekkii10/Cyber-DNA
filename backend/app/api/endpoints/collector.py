from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas import EventCreate, CollectorStatus, CollectorHeartbeat
from app.db.database import get_db
from app.db.models import Event, Computer
from datetime import datetime, timezone

router = APIRouter()

@router.post("/collector/events", status_code=201)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    comp_id = None
    if event.computer:
        comp = db.query(Computer).filter(Computer.hostname == event.computer).first()
        if not comp:
            comp = Computer(hostname=event.computer)
            db.add(comp)
            db.commit()
            db.refresh(comp)
        comp_id = comp.id

    db_event = Event(
        timestamp=event.timestamp,
        event_id=event.event_id,
        username=event.username,
        domain=event.domain,
        logon_type=event.logon_type,
        source_ip=event.source_ip,
        computer_id=comp_id,
        record_id=event.record_id,
        result=event.result,
        action=event.action,
        event_details=event.event_details,
        channel=event.channel,
        provider=event.provider,
        raw_event=event.raw_event
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return {"message": "Event received"}

@router.get("/collector/status", response_model=CollectorStatus)
def get_collector_status():
    return CollectorStatus(
        status="online",
        last_event=datetime.now(timezone.utc),
        events_received=12482,
        last_heartbeat=datetime.now(timezone.utc)
    )

@router.post("/collector/heartbeat", status_code=201)
def heartbeat(heartbeat: CollectorHeartbeat):
    return {"status": "recorded"}
