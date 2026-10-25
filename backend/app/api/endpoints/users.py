from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import UserResponse, EventResponse, AlertResponse
from app.db.database import get_db
from app.db.models import User, Event, Alert

router = APIRouter()


def _serialize_user(user: User, db: Session) -> dict:
    events = db.query(Event).filter(Event.username == user.username).order_by(Event.timestamp.desc(), Event.id.desc()).limit(25).all()
    alerts = db.query(Alert).filter(Alert.user == user.username).order_by(Alert.time.desc(), Alert.id.asc()).limit(25).all()
    return {
        "username": user.username, "department": user.department, "status": user.status,
        "risk_score": user.risk_score or 0, "baseline": {}, "recent_anomalies": [],
        "last_seen": events[0].timestamp if events else None,
        "recent_events": [{
            "id": e.id, "event_id": e.event_id, "timestamp": e.timestamp,
            "computer": e.computer, "source_ip": e.source_ip,
            "result": e.result, "action": e.action,
        } for e in events],
        "recent_alerts": [{
            "id": a.id, "severity": a.severity, "rule": a.rule, "rule_id": a.rule_id,
            "score": a.score, "time": a.time, "detail": a.detail,
            "host": a.host, "ip": a.ip, "status": a.status,
        } for a in alerts],
    }


@router.get("/users", response_model=List[UserResponse])
def get_users(
    page: int = 1,
    limit: int = 50,
    department: Optional[str] = None,
    status: Optional[str] = None,
    min_risk: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    page = max(1, page)
    limit = max(1, min(200, limit))
    query = db.query(User)
    if department:
        query = query.filter(User.department == department)
    if status:
        query = query.filter(User.status == status)
    if min_risk is not None:
        query = query.filter(User.risk_score >= min_risk)
    if search:
        query = query.filter(User.username.contains(search))
    users = query.order_by(User.username.asc()).offset((page - 1) * limit).limit(limit).all()
    return [_serialize_user(user, db) for user in users]


@router.get("/users/{username}", response_model=UserResponse)
def get_user(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(user, db)


@router.get("/users/{username}/events", response_model=List[EventResponse])
def get_user_events(username: str, db: Session = Depends(get_db)):
    events = db.query(Event).filter(Event.username == username).order_by(Event.timestamp.desc()).limit(100).all()
    return events


@router.get("/users/{username}/alerts", response_model=List[AlertResponse])
def get_user_alerts(username: str, db: Session = Depends(get_db)):
    alerts = db.query(Alert).filter(Alert.user == username).order_by(Alert.time.desc()).limit(100).all()
    return alerts


@router.get("/users/{username}/risk")
def get_user_risk(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"risk_score": user.risk_score, "supporting_info": [], "meaning": "Stored profile field; no user risk scoring pipeline is implemented."}


@router.get("/users/{username}/behavior")
def get_user_behavior(username: str, db: Session = Depends(get_db)):
    if not db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=404, detail="User not found")
    return {"baseline": {}, "anomalies": [], "behavior_signals": [],
            "status": "not_implemented", "message": "A learned user baseline and user-level behavior scoring are not currently implemented."}
