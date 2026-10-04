from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import RuleResponse
from app.db.database import get_db
from app.db.models import DetectionRule

router = APIRouter()

@router.get("/rules", response_model=List[RuleResponse])
def get_rules(db: Session = Depends(get_db)):
    rules = db.query(DetectionRule).all()
    return rules

@router.get("/rules/{rule_id}", response_model=RuleResponse)
def get_rule(rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(DetectionRule).filter(DetectionRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="DetectionRule not found")
    return rule

@router.get("/rules/{rule_id}/stats")
def get_rule_stats(rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(DetectionRule).filter(DetectionRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="DetectionRule not found")
    return {"alert_count": rule.alert_count}
