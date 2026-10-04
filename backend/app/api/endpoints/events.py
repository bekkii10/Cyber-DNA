from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.schemas import EventResponse, EventStats
from app.db.database import get_db
from app.db.models import Event, Computer

router = APIRouter()

@router.get("/events", response_model=List[EventResponse])
def get_events(
    page: int = 1,
    limit: int = 50,
    event_id: Optional[int] = None,
    username: Optional[str] = None,
    computer: Optional[str] = None,
    result: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Event)
    if computer:
        query = query.join(Computer).filter(Computer.hostname == computer)
    if event_id is not None:
        query = query.filter(Event.event_id == event_id)
    if username:
        query = query.filter(Event.username == username)
    if result:
        query = query.filter(Event.result == result)
    if start_time:
        query = query.filter(Event.timestamp >= start_time)
    if end_time:
        query = query.filter(Event.timestamp <= end_time)
        
    offset = (page - 1) * limit
    events = query.order_by(Event.timestamp.desc()).offset(offset).limit(limit).all()
    return events

@router.get("/events/stats", response_model=EventStats)
def get_events_stats(db: Session = Depends(get_db)):
    total = db.query(Event).count()
    return EventStats(
        total=total,
        by_event_id={},
        by_result={},
        by_hour=[]
    )

@router.get("/events/{event_id_param}", response_model=EventResponse)
def get_event(event_id_param: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id_param).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
