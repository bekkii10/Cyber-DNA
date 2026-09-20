from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_db
from app.schemas.alert import AlertResponse
from app.db.models import Alert

router = APIRouter()

@router.get("/", response_model=List[AlertResponse])
def read_alerts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve alerts for the SOC dashboard.
    """
    alerts = db.query(Alert).order_by(Alert.timestamp.desc()).offset(skip).limit(limit).all()
    return alerts
