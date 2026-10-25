from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import AlertResponse, AlertSeenUpdate, AlertStatusUpdate, AlertMarkAllSeenResponse, AlertUnseenCount, EventResponse
from app.db.database import get_db
from app.db.models import Alert

router = APIRouter()

@router.get("/alerts", response_model=List[AlertResponse])
def get_alerts(
    page: int = 1,
    limit: int = 50,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    seen: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if severity:
        query = query.filter(Alert.severity == severity)
    if seen is not None:
        query = query.filter(Alert.seen == seen)
    # Basic search could check user or host or detail
    if search:
        query = query.filter((Alert.user.contains(search)) | (Alert.host.contains(search)))
        
    offset = (page - 1) * limit
    alerts = query.order_by(Alert.time.desc()).offset(offset).limit(limit).all()
    return alerts

@router.get("/alerts/unseen/count", response_model=AlertUnseenCount)
def get_unseen_count(db: Session = Depends(get_db)):
    count = db.query(Alert).filter(Alert.seen == False).count()
    return AlertUnseenCount(count=count)

@router.post("/alerts/mark-all-seen", response_model=AlertMarkAllSeenResponse)
def mark_all_seen(db: Session = Depends(get_db)):
    alerts = db.query(Alert).filter(Alert.seen == False).all()
    count = len(alerts)
    for alert in alerts:
        alert.seen = True
    db.commit()
    return AlertMarkAllSeenResponse(updated=count)

@router.get("/alerts/{alert_id}/events", response_model=List[EventResponse])
def get_alert_events(alert_id: str, db: Session = Depends(get_db)):
    """Return the original stored events that support a detection alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return sorted(alert.events, key=lambda event: (event.timestamp is None, event.timestamp, event.id))


@router.get("/alerts/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.patch("/alerts/{alert_id}/seen", response_model=AlertResponse)
def update_alert_seen(alert_id: str, payload: AlertSeenUpdate, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.seen = payload.seen
    db.commit()
    db.refresh(alert)
    return alert


@router.patch("/alerts/{alert_id}/status", response_model=AlertResponse)
def update_alert_status(alert_id: str, payload: AlertStatusUpdate, db: Session = Depends(get_db)):
    allowed = {"new", "investigating", "acknowledged", "resolved"}
    status = payload.status.strip().lower()
    if status not in allowed:
        raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(sorted(allowed))}")
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = status
    if status in {"acknowledged", "investigating", "resolved"}:
        alert.seen = True
    db.commit()
    db.refresh(alert)
    return alert
