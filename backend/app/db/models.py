from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.db.database import Base

class RawEvent(Base):
    __tablename__ = "events_raw"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    raw_json = Column(JSON)

class NormalizedEvent(Base):
    __tablename__ = "events_normalized"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True))
    event_type = Column(String, index=True)
    user_name = Column(String, index=True, nullable=True)
    computer_name = Column(String, index=True, nullable=True)
    source_ip = Column(String, nullable=True)
    status = Column(String, nullable=True)
    raw_event_id = Column(Integer, ForeignKey("events_raw.id"))

class Entity(Base):
    __tablename__ = "entities"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String)  # 'user' or 'computer'
    name = Column(String, index=True, unique=True)
    is_privileged = Column(Boolean, default=False)
    department = Column(String, nullable=True)

class Baseline(Base):
    __tablename__ = "baselines"
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"))
    feature_name = Column(String)
    mean_value = Column(Float)
    std_dev = Column(Float)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String, unique=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"))
    risk_score = Column(Float)
    severity = Column(String)
    reasons_json = Column(JSON)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
