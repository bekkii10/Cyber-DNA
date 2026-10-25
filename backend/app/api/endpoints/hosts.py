from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.schemas import ComputerResponse, EventResponse, AlertResponse
from app.db.database import get_db
from app.db.models import Computer, Event, Alert

router = APIRouter()


def _serialize_host(host: Computer, db: Session) -> dict:
    event_count = db.query(func.count(Event.id)).filter(Event.computer_id == host.id).scalar() or 0
    return {
        "hostname": host.hostname, "status": host.status, "risk_score": host.risk_score or 0,
        "ip": host.ip_address, "os": None, "last_seen": host.last_seen,
        "event_count": int(event_count), "role": None,
    }


@router.get("/hosts", response_model=List[ComputerResponse])
def get_computers(
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    min_risk: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Computer)
    if status:
        query = query.filter(Computer.status == status)
    if min_risk is not None:
        query = query.filter(Computer.risk_score >= min_risk)
    if search:
        query = query.filter(Computer.hostname.contains(search))
        
    offset = (page - 1) * limit
    hosts = query.offset(offset).limit(limit).all()
    return [_serialize_host(host, db) for host in hosts]

@router.get("/hosts/{hostname}", response_model=ComputerResponse)
def get_computer(hostname: str, db: Session = Depends(get_db)):
    host = db.query(Computer).filter(Computer.hostname == hostname).first()
    if not host:
        raise HTTPException(status_code=404, detail="Computer not found")
    return _serialize_host(host, db)

@router.get("/hosts/{hostname}/events", response_model=List[EventResponse])
def get_computer_events(hostname: str, db: Session = Depends(get_db)):
    events = db.query(Event).filter(Event.comp_rel.has(hostname=hostname)).order_by(Event.timestamp.desc()).limit(100).all()
    return events

@router.get("/hosts/{hostname}/alerts", response_model=List[AlertResponse])
def get_computer_alerts(hostname: str, db: Session = Depends(get_db)):
    alerts = db.query(Alert).filter(Alert.host == hostname).order_by(Alert.time.desc()).limit(100).all()
    return alerts
