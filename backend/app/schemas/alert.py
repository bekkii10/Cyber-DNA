from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime

class AlertBase(BaseModel):
    alert_id: str
    risk_score: float
    severity: str
    reasons_json: Dict[str, Any]

class AlertResponse(AlertBase):
    id: int
    entity_id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True
