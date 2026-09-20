from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime

# Schema for incoming raw data from Winlogbeat
class RawEventCreate(BaseModel):
    raw_data: Dict[str, Any]

class NormalizedEventBase(BaseModel):
    timestamp: datetime
    event_type: str
    user_name: Optional[str] = None
    computer_name: Optional[str] = None
    source_ip: Optional[str] = None
    status: Optional[str] = None

class NormalizedEventResponse(NormalizedEventBase):
    id: int
    raw_event_id: Optional[int] = None
    
    class Config:
        from_attributes = True
