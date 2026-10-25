from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import AuthUser, Organization, OnboardingState, PricingRule, AuditLog, Event, DetectionRule
from app.services.security import get_principal, require_platform_admin

router = APIRouter(prefix="/onboarding", tags=["onboarding"])
class SaveSetup(BaseModel):
    current_step: int = Field(ge=1, le=8)
    organization: dict | None = None
    assessment: dict = Field(default_factory=dict)
    selected_plan: str | None = None
    plan_status: str | None = None

class PricingRuleBody(BaseModel):
    key: str = Field(min_length=2, max_length=80)
    value: float = Field(ge=0, le=1_000_000_000)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    active: bool = False

def _org(user: AuthUser, db: Session):
    if not user.organization_id: raise HTTPException(403, "No organization is assigned to this account")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org: raise HTTPException(404, "Organization not found")
    return org

@router.get("")
def get_setup(user: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    org = _org(user, db)
    state = db.query(OnboardingState).filter_by(organization_id=org.id).first()
    if not state:
        state = OnboardingState(organization_id=org.id); db.add(state); db.commit(); db.refresh(state)
    return {"organization": {"id": org.id, "name": org.name, "industry": org.industry, "country": org.country, "timezone": org.timezone, "contact_email": org.contact_email}, "current_step": state.current_step, "completed": state.completed, "assessment": state.assessment or {}, "selected_plan": state.selected_plan, "plan_status": state.plan_status, "estimate": state.estimate, "activation_status": state.activation_status}

@router.put("")
def save_setup(body: SaveSetup, user: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    if user.role not in {"platform_admin", "org_admin"}: raise HTTPException(403, "Organization administrator role required")
    org = _org(user, db); state = db.query(OnboardingState).filter_by(organization_id=org.id).first()
    if not state: state = OnboardingState(organization_id=org.id); db.add(state)
    if body.organization:
        allowed = {"name", "industry", "country", "timezone", "contact_email"}
        for key, value in body.organization.items():
            if key in allowed and value is not None: setattr(org, key, str(value)[:250])
    state.current_step = body.current_step
    state.assessment = body.assessment
    if body.selected_plan is not None: state.selected_plan = body.selected_plan
    if body.plan_status is not None:
        if body.plan_status not in {"not_selected", "estimate", "pending_approval", "approved", "activated"}: raise HTTPException(422, "Invalid plan status")
        if body.plan_status in {"approved", "activated"} and user.role != "platform_admin": raise HTTPException(403, "Only platform administrators can approve or activate plans")
        state.plan_status = body.plan_status
    if body.current_step == 8:
        # Completing onboarding is separate from declaring the monitoring service active.
        from datetime import datetime, timezone, timedelta
        latest = db.query(Event.timestamp).order_by(Event.timestamp.desc()).first()
        ts = latest[0] if latest else None
        receiving = bool(ts and (ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts) >= datetime.now(timezone.utc)-timedelta(minutes=2))
        state.completed = True
        state.activation_status = "receiving_events" if receiving else "pending_connection"
        if body.plan_status == "activated":
            if user.role != "platform_admin": raise HTTPException(403, "Only platform administrators can activate a service")
            if not receiving: raise HTTPException(409, "Activation cannot be confirmed: no event received in the last two minutes")
            if db.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).count() == 0:
                raise HTTPException(409, "Activation cannot be confirmed: no enabled detection rules are available")
            org.status = "active"
        else:
            org.status = "pending_activation"
    db.add(AuditLog(actor_user_id=user.id, organization_id=org.id, action="onboarding_saved", details={"step": body.current_step}))
    db.commit()
    return {"saved": True, "current_step": state.current_step, "completed": state.completed, "plan_status": state.plan_status, "activation_status": state.activation_status}

@router.post("/estimate")
def estimate(user: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    org = _org(user, db)
    rules = {r.key: r for r in db.query(PricingRule).filter(PricingRule.active.is_(True)).all()}
    required = {"base_monthly", "included_endpoints", "endpoint_monthly", "included_identities", "identity_monthly", "setup_fee"}
    if not required.issubset(rules):
        raise HTTPException(409, {"message": "Pricing has not been configured by a platform administrator", "missing_rules": sorted(required-rules.keys())})
    state = db.query(OnboardingState).filter_by(organization_id=org.id).first()
    a = (state.assessment or {}) if state else {}
    def quantity(key):
        value = a.get(key)
        return max(0, int(value)) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0
    endpoints = quantity("endpoints"); identities = quantity("enabled_ad_accounts")
    endpoint_cost = max(0, endpoints-rules["included_endpoints"].value)*rules["endpoint_monthly"].value
    identity_cost = max(0, identities-rules["included_identities"].value)*rules["identity_monthly"].value
    monthly = rules["base_monthly"].value + endpoint_cost + identity_cost
    currency = rules["base_monthly"].currency
    result = {"type":"estimate", "currency":currency, "monthly_cost":round(monthly,2), "setup_fee":rules["setup_fee"].value, "assumptions":{"endpoints":endpoints,"enabled_ad_accounts":identities,"included_endpoints":rules["included_endpoints"].value,"included_identities":rules["included_identities"].value}, "requires_approval":True, "not_a_quote":True}
    if state: state.estimate = result; state.plan_status = "estimate"; db.commit()
    return result

@router.put("/pricing-rules")
def set_pricing_rule(body: PricingRuleBody, admin: AuthUser = Depends(require_platform_admin), db: Session = Depends(get_db)):
    rule = db.query(PricingRule).filter_by(key=body.key).first()
    if not rule: rule = PricingRule(key=body.key, value=body.value, currency=body.currency, active=body.active); db.add(rule)
    else: rule.value=body.value; rule.currency=body.currency; rule.active=body.active
    db.add(AuditLog(actor_user_id=admin.id, organization_id=admin.organization_id, action="pricing_rule_updated", details={"key":body.key,"active":body.active})); db.commit()
    return {"key":rule.key,"value":rule.value,"currency":rule.currency,"active":rule.active}

class PlanDecision(BaseModel):
    status: str = Field(pattern="^(approved|activated|pending_approval)$")

@router.put("/organizations/{organization_id}/plan")
def decide_plan(organization_id: int, body: PlanDecision, admin: AuthUser = Depends(require_platform_admin), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org: raise HTTPException(404, "Organization not found")
    state = db.query(OnboardingState).filter_by(organization_id=organization_id).first()
    if not state: raise HTTPException(404, "Onboarding state not found")
    state.plan_status = body.status
    if body.status == "activated":
        from datetime import datetime, timezone, timedelta
        db.info["organization_id"] = organization_id
        latest = db.query(Event.timestamp).order_by(Event.timestamp.desc()).first()
        ts = latest[0] if latest else None
        if not ts or (ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts) < datetime.now(timezone.utc)-timedelta(minutes=2):
            raise HTTPException(409, "Cannot activate: no event has been received for this organization in the last two minutes")
        if db.query(DetectionRule).filter(DetectionRule.enabled.is_(True)).count() == 0:
            raise HTTPException(409, "Cannot activate: no enabled detection rules are available")
        state.activation_status = "receiving_events"
        org.status = "active"
    elif body.status == "approved":
        org.status = "pending_activation"
    else:
        org.status = "onboarding"
    db.add(AuditLog(actor_user_id=admin.id, organization_id=organization_id, action="plan_status_changed", details={"status":body.status}))
    db.commit()
    return {"organization_id":organization_id,"plan_status":state.plan_status,"organization_status":org.status,"activation_status":state.activation_status}
