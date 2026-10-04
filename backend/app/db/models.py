from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey, Boolean, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

alert_events = Table(
    'alert_events',
    Base.metadata,
    Column('alert_id', String, ForeignKey('alerts.id'), primary_key=True),
    Column('event_id', Integer, ForeignKey('events.id'), primary_key=True)
)

user_computer = Table(
    'user_computer',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('computer_id', Integer, ForeignKey('computers.id'), primary_key=True),
    Column('first_seen', DateTime(timezone=True), server_default=func.now()),
    Column('last_seen', DateTime(timezone=True), onupdate=func.now())
)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    event_id = Column(Integer, index=True)
    username = Column(String, index=True, nullable=True)
    domain = Column(String, nullable=True)
    
    comp_rel = relationship("Computer")
    
    @property
    def computer(self):
        return self.comp_rel.hostname if self.comp_rel else None

    computer_id = Column(Integer, ForeignKey("computers.id"), nullable=True)
    source_ip = Column(String, nullable=True)
    logon_type = Column(Integer, nullable=True)
    result = Column(String, nullable=True)
    action = Column(String, nullable=True)
    record_id = Column(Integer, index=True, nullable=True)
    channel = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    event_details = Column(JSON, nullable=True)
    raw_event = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    alerts = relationship("Alert", secondary=alert_events, back_populates="events")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    department = Column(String, nullable=True)
    status = Column(String, default="Active")
    risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    computers = relationship("Computer", secondary=user_computer, back_populates="users")

class Computer(Base):
    __tablename__ = "computers"
    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String, unique=True, index=True)
    ip_address = Column(String, nullable=True)
    status = Column(String, default="online")
    risk_score = Column(Float, default=0.0)
    last_seen = Column(DateTime(timezone=True), onupdate=func.now())
    
    users = relationship("User", secondary=user_computer, back_populates="computers")

class DetectionRule(Base):
    __tablename__ = "detection_rules"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    type = Column(String, nullable=True)
    severity = Column(String)
    logic = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    alert_count = Column(Integer, default=0)

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    risk = Column(String)
    score = Column(Float)
    status = Column(String, default="OPEN")
    first_seen = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    alerts = relationship("Alert", back_populates="incident")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=True)
    rule_id = Column(String, ForeignKey("detection_rules.id"), nullable=True)
    severity = Column(String, index=True)
    score = Column(Float, nullable=True)
    user = Column(String, nullable=True)
    host = Column(String, nullable=True)
    ip = Column(String, nullable=True)
    time = Column(DateTime(timezone=True))
    detail = Column(String, nullable=True)
    source = Column(String, nullable=True)
    explanation = Column(String, nullable=True)
    seen = Column(Boolean, default=False)
    status = Column(String, default="new")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    detection_rule = relationship("DetectionRule")
    
    @property
    def rule(self):
        return self.detection_rule.name if self.detection_rule else "Unknown Rule"
        
    incident = relationship("Incident", back_populates="alerts")
    events = relationship("Event", secondary=alert_events, back_populates="alerts")

class MLAnalytics(Base):
    __tablename__ = "ml_analysis"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    computer_id = Column(Integer, ForeignKey("computers.id"), nullable=True)
    analysis_time = Column(DateTime(timezone=True), server_default=func.now())
    risk_score = Column(Float)
    explanation = Column(String, nullable=True)
    recommendations = Column(String, nullable=True)

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    computer_id = Column(Integer, ForeignKey("computers.id"))
    login_time = Column(DateTime(timezone=True))
    logout_time = Column(DateTime(timezone=True), nullable=True)
