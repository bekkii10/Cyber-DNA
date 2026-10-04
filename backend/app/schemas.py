from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime

class HealthCheck(BaseModel):
    status: str
    database: str
    collector: str
    ml_engine: str

class DashboardOverview(BaseModel):
    events_count: int
    active_alerts: int
    open_incidents: int
    high_risk_users: int
    monitored_hosts: int
    event_activity: List[Any] = []
    risk_distribution: Dict[str, Any] = {}
    recent_events: List[Any] = []
    recent_alerts: List[Any] = []

class DashboardActivity(BaseModel):
    hours: int
    points: List[Any] = []

class EventCreate(BaseModel):
    timestamp: datetime
    event_id: int
    username: Optional[str] = None
    domain: Optional[str] = None
    logon_type: Optional[int] = None
    source_ip: Optional[str] = None
    computer: Optional[str] = None
    channel: Optional[str] = None
    provider: Optional[str] = None
    raw_event: Optional[Dict[str, Any]] = None
    record_id: Optional[int] = None
    result: Optional[str] = None
    action: Optional[str] = None
    event_details: Optional[Dict[str, Any]] = {}

class EventResponse(EventCreate):
    id: int
    
    class Config:
        from_attributes = True

class EventStats(BaseModel):
    total: int
    by_event_id: Dict[str, Any] = {}
    by_result: Dict[str, Any] = {}
    by_hour: List[Any] = []

class CollectorStatus(BaseModel):
    status: str
    last_event: Optional[datetime] = None
    events_received: int = 0
    last_heartbeat: Optional[datetime] = None

class CollectorHeartbeat(BaseModel):
    collector: str
    hostname: str
    timestamp: datetime

class AlertBase(BaseModel):
    severity: str
    rule: str
    score: float
    user: Optional[str] = None
    host: Optional[str] = None
    ip: Optional[str] = None
    time: datetime
    detail: Optional[str] = None
    source: Optional[str] = None
    explanation: Optional[str] = None
    seen: bool = False

class AlertResponse(AlertBase):
    id: str

    class Config:
        from_attributes = True
        populate_by_name = True

class AlertSeenUpdate(BaseModel):
    seen: bool

class AlertMarkAllSeenResponse(BaseModel):
    updated: int

class AlertUnseenCount(BaseModel):
    count: int

class IncidentResponse(BaseModel):
    id: str
    title: str
    risk: str
    score: float
    status: str
    users: List[Any] = []
    hosts: List[Any] = []
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    chain: List[Any] = []
    related_alerts: List[Any] = []
    related_events: List[Any] = []

    class Config:
        from_attributes = True

class IncidentStatusUpdate(BaseModel):
    status: str

class UserResponse(BaseModel):
    username: str
    department: Optional[str] = None
    status: str
    risk_score: float
    baseline: Dict[str, Any] = {}
    recent_anomalies: List[Any] = []
    recent_events: List[Any] = []
    recent_alerts: List[Any] = []
    
    class Config:
        from_attributes = True

class ComputerResponse(BaseModel):
    hostname: str
    status: str
    risk_score: float
    
    class Config:
        from_attributes = True

class RuleResponse(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    severity: str
    logic: Optional[str] = None
    enabled: bool
    alert_count: int

    class Config:
        from_attributes = True

class AnalyzeRequest(BaseModel):
    event_ids: List[int]

class AnalyzeResponse(BaseModel):
    detected: bool
    risk_score: float
    anomaly_score: float
    reason: str
    explanation: str

class DetectionStatus(BaseModel):
    status: str
    model: str
    last_analysis: Optional[str] = None

class CorrelationResponse(BaseModel):
    status: str
    incidents_created: int
    incidents_updated: int
