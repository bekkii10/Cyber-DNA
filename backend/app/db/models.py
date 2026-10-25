from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, ForeignKey, Boolean, Table, UniqueConstraint
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
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
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
    __table_args__ = (UniqueConstraint("organization_id", "username", name="uq_users_org_username"),)
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    username = Column(String, index=True)
    department = Column(String, nullable=True)
    status = Column(String, default="Active")
    risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    computers = relationship("Computer", secondary=user_computer, back_populates="users")

class Computer(Base):
    __tablename__ = "computers"
    __table_args__ = (UniqueConstraint("organization_id", "hostname", name="uq_computers_org_hostname"),)
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    hostname = Column(String, index=True)
    ip_address = Column(String, nullable=True)
    status = Column(String, default="online")
    risk_score = Column(Float, default=0.0)
    last_seen = Column(DateTime(timezone=True), onupdate=func.now())
    
    users = relationship("User", secondary=user_computer, back_populates="computers")

class DetectionRule(Base):
    __tablename__ = "detection_rules"
    id = Column(String, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String)
    type = Column(String, nullable=True)
    severity = Column(String)
    logic = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    alert_count = Column(Integer, default=0)

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
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
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
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
        return self.detection_rule.name if self.detection_rule else ("ML behavioral anomaly" if self.source and self.source.startswith("ml:") else "Unknown Rule")

    @property
    def detection_source(self):
        if self.incident_id and self.source == "correlated":
            return "correlated"
        if self.source and self.source.startswith("ml:"):
            return "ml"
        return "rule" if self.rule_id else (self.source or "unknown")
        
    incident = relationship("Incident", back_populates="alerts")
    events = relationship("Event", secondary=alert_events, back_populates="alerts")
    findings = relationship("DetectionFinding", foreign_keys="DetectionFinding.alert_id", back_populates="alert")

class MLAnalytics(Base):
    __tablename__ = "ml_analysis"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    computer_id = Column(Integer, ForeignKey("computers.id"), nullable=True)
    analysis_time = Column(DateTime(timezone=True), server_default=func.now())
    risk_score = Column(Float)
    explanation = Column(String, nullable=True)
    recommendations = Column(String, nullable=True)

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    computer_id = Column(Integer, ForeignKey("computers.id"))
    login_time = Column(DateTime(timezone=True))
    logout_time = Column(DateTime(timezone=True), nullable=True)


class DetectionFinding(Base):
    """Normalized provenance record for rule/ML/correlated detections."""
    __tablename__ = "detection_findings"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    finding_key = Column(String, unique=True, index=True, nullable=False)
    engine_type = Column(String, index=True, nullable=False)  # rule | ml | correlated
    detection_name = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True, index=True)
    score = Column(Float, nullable=True)
    predicted_class = Column(String, nullable=True)
    model_version = Column(String, nullable=True)
    evidence = Column(JSON, nullable=True)
    feature_values = Column(JSON, nullable=True)
    reasons = Column(JSON, nullable=True)
    alert_id = Column(String, ForeignKey("alerts.id"), nullable=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=True)
    alert = relationship("Alert", foreign_keys=[alert_id], back_populates="findings")
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    industry = Column(String, nullable=True)
    country = Column(String, nullable=True)
    timezone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    status = Column(String, nullable=False, default="onboarding")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuthUser(Base):
    __tablename__ = "auth_users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="org_admin")
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    must_change_password = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    organization = relationship("Organization")

class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("auth_users.id"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("AuthUser")

class OnboardingState(Base):
    __tablename__ = "onboarding_states"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, unique=True, index=True)
    current_step = Column(Integer, nullable=False, default=1)
    completed = Column(Boolean, nullable=False, default=False)
    assessment = Column(JSON, nullable=False, default=dict)
    selected_plan = Column(String, nullable=True)
    plan_status = Column(String, nullable=False, default="not_selected")
    estimate = Column(JSON, nullable=True)
    activation_status = Column(String, nullable=False, default="not_configured")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PricingRule(Base):
    __tablename__ = "pricing_rules"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="USD")
    active = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("auth_users.id"), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    action = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class CollectorCredential(Base):
    __tablename__ = "collector_credentials"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
