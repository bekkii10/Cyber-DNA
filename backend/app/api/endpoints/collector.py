from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.schemas import EventCreate, CollectorStatus, CollectorHeartbeat
from app.db.database import get_db
from app.db.models import Event, Computer, User
from app.services.detection_engine import run_detection_for_event
from app.services.security import require_collector
from fastapi import Request

router = APIRouter(dependencies=[Depends(require_collector)])

@router.post('/collector/events', status_code=201)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    comp_id = None
    if event.computer:
        comp = db.query(Computer).filter(Computer.hostname == event.computer).first()
        if not comp:
            comp = Computer(hostname=event.computer, status='online')
            db.add(comp)
            db.flush()
        comp.last_seen = event.timestamp
        comp.status = 'online'
        comp_id = comp.id

    # Windows EventRecordID is stable within a host and channel. When supplied,
    # use it to make collector retries idempotent. Do not guess duplicates for
    # records without a stable record_id.
    if comp_id is not None and event.record_id is not None:
        duplicate = db.query(Event).filter(
            Event.computer_id == comp_id,
            Event.record_id == event.record_id,
            Event.channel == event.channel,
        ).first()
        if duplicate:
            return JSONResponse(status_code=200, content={
                'message': 'Duplicate event ignored; existing event returned',
                'event_id': duplicate.id,
                'stored': False,
                'duplicate': True,
                'detection': {'status': 'not_rerun_for_duplicate'},
            })
    if event.username:
        username = event.username.strip()
        if username and username not in ('-', 'SYSTEM', 'ANONYMOUS LOGON'):
            user = db.query(User).filter(User.username == username).first()
            if not user:
                db.add(User(username=username, status='Active', risk_score=0))
    db_event = Event(timestamp=event.timestamp, event_id=event.event_id, username=event.username,
        domain=event.domain, logon_type=event.logon_type, source_ip=event.source_ip,
        computer_id=comp_id, record_id=event.record_id, result=event.result, action=event.action,
        event_details=event.event_details, channel=event.channel, provider=event.provider, raw_event=event.raw_event)
    db.add(db_event)
    db.flush()
    # Run deterministic rules on ingestion so alerts do not depend on a manual API call.
    detection_result = run_detection_for_event(db, db_event)
    db.refresh(db_event)
    return {
        'message': 'Event received',
        'event_id': db_event.id,
        'stored': True,
        'detection': detection_result,
    }

@router.get('/collector/status', response_model=CollectorStatus)
def get_collector_status(db: Session = Depends(get_db)):
    latest = db.query(Event.timestamp).order_by(Event.timestamp.desc()).first()
    total = db.query(Event).count()
    last_event = latest[0] if latest else None
    if last_event and last_event.tzinfo is None:
        last_event = last_event.replace(tzinfo=timezone.utc)
    online = bool(last_event and last_event >= datetime.now(timezone.utc) - timedelta(minutes=2))
    return CollectorStatus(status='online' if online else 'offline', last_event=last_event,
                          events_received=total, last_heartbeat=None)

@router.post('/collector/heartbeat', status_code=201)
def heartbeat(heartbeat: CollectorHeartbeat):
    # Heartbeat is acknowledged, but not persisted. Collector status is based on actual ingested events.
    return {'status': 'acknowledged', 'collector': heartbeat.collector, 'hostname': heartbeat.hostname,
            'timestamp': heartbeat.timestamp, 'persisted': False}
