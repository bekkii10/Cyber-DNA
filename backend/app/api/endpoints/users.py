from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
from app.schemas import UserResponse, EventResponse, AlertResponse
from app.db.database import get_db
from app.db.models import User, Event, Alert

router = APIRouter()

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
    query = db.query(User)
    if department:
        query = query.filter(User.department == department)
    if status:
        query = query.filter(User.status == status)
    if min_risk is not None:
        query = query.filter(User.risk_score >= min_risk)
    if search:
        query = query.filter(User.username.contains(search))
        
    offset = (page - 1) * limit
    users = query.offset(offset).limit(limit).all()
    return users

@router.get("/users/{username}", response_model=UserResponse)
def get_user(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

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
    return {"risk_score": user.risk_score, "supporting_info": []}

@router.get("/users/{username}/behavior")
def get_user_behavior(username: str, db: Session = Depends(get_db)):
    return {"baseline": {}, "anomalies": [], "behavior_signals": []}
