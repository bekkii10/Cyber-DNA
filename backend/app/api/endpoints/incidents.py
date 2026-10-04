from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import IncidentResponse, IncidentStatusUpdate
from app.db.database import get_db
from app.db.models import Incident

router = APIRouter()

@router.get("/incidents", response_model=List[IncidentResponse])
def get_incidents(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    risk: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if risk:
        query = query.filter(Incident.risk == risk)
        
    offset = (page - 1) * limit
    incidents = query.order_by(Incident.created_at.desc()).offset(offset).limit(limit).all()
    return incidents

@router.get("/incidents/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.patch("/incidents/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(incident_id: str, payload: IncidentStatusUpdate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = payload.status
    db.commit()
    db.refresh(incident)
    return incident
