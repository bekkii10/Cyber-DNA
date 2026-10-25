from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.correlation import correlate_recent

router = APIRouter()

@router.get("/correlation/status")
def get_correlation_status(db: Session = Depends(get_db)):
    result = correlate_recent(db, lookback_minutes=15)
    return {"status": "available", **result}

@router.post("/correlation/run")
def run_correlation(db: Session = Depends(get_db)):
    return correlate_recent(db, lookback_minutes=15)
