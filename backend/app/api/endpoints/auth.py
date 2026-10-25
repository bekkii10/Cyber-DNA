import os, re, hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import AuthUser, AuthSession, Organization, AuditLog, OnboardingState, CollectorCredential
from app.services.security import SESSION_COOKIE, hash_password, verify_password, create_session, get_principal, require_platform_admin
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])
class LoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=1024)
class PasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(min_length=12, max_length=256)
class TemporaryPasswordBody(BaseModel):
    new_password: str = Field(min_length=12, max_length=256)

class CreateUserBody(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: str | None = None
    temporary_password: str = Field(min_length=12, max_length=256)
    role: str = "org_admin"
    organization_id: int | None = None
class BootstrapBody(BaseModel):
    bootstrap_secret: str
    username: str = Field(min_length=3, max_length=80)
    email: str | None = None
    password: str = Field(min_length=12, max_length=256)
    organization_name: str = Field(min_length=2, max_length=200)

@router.post("/bootstrap", status_code=201)
def bootstrap(body: BootstrapBody, db: Session = Depends(get_db)):
    """One-time bootstrap protected by an out-of-band secret; disabled after first platform admin."""
    if db.query(AuthUser).filter(AuthUser.role == "platform_admin").first():
        raise HTTPException(409, "Platform administrator already exists")
    secret = settings.CYBERDNA_BOOTSTRAP_SECRET or os.getenv("CYBERDNA_BOOTSTRAP_SECRET", "")
    if not secret or not __import__('hmac').compare_digest(secret, body.bootstrap_secret):
        raise HTTPException(403, "Bootstrap unavailable or secret invalid")
    org = Organization(name=body.organization_name, status="onboarding")
    db.add(org); db.flush()
    # Before tenant support all persisted telemetry belonged to the single local deployment.
    # Assign those legacy rows to its first organization, never to subsequently created tenants.
    from app.db.models import Event, User as DirectoryUser, Computer, Incident, Alert, MLAnalytics, Session as DirectorySession, DetectionFinding
    for model in (Event, DirectoryUser, Computer, Incident, Alert, MLAnalytics, DirectorySession, DetectionFinding):
        db.query(model).filter(model.organization_id.is_(None)).update({model.organization_id: org.id}, synchronize_session=False)
    user = AuthUser(username=body.username, email=body.email, password_hash=hash_password(body.password), role="platform_admin", organization_id=org.id, must_change_password=False)
    db.add(user); db.flush()
    db.add(OnboardingState(organization_id=org.id))
    db.add(AuditLog(actor_user_id=user.id, organization_id=org.id, action="platform_admin_bootstrapped"))
    db.commit()
    return {"created": True, "username": user.username, "organization_id": org.id}

@router.post("/login")
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)):
    user = db.query(AuthUser).filter((AuthUser.username == body.username) | (AuthUser.email == body.username)).first()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    token = create_session(db, user)
    secure = settings.CYBERDNA_COOKIE_SECURE or os.getenv("CYBERDNA_COOKIE_SECURE", "false").lower() == "true"
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=secure, samesite="lax", max_age=8*60*60, path="/")
    return {"authenticated": True, "must_change_password": user.must_change_password, "role": user.role, "organization_id": user.organization_id, "username": user.username}

@router.post("/logout")
def logout(request: Request, response: Response, user: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    auth = request.headers.get("authorization", "")
    if not token and auth.lower().startswith("bearer "): token = auth[7:].strip()
    if token:
        digest = hashlib.sha256(token.encode()).hexdigest()
        row = db.query(AuthSession).filter(AuthSession.token_hash == digest, AuthSession.user_id == user.id).first()
        if row: row.revoked_at = datetime.now(timezone.utc); db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"logged_out": True}

@router.get("/me")
def me(user: AuthUser = Depends(get_principal)):
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role, "organization_id": user.organization_id, "must_change_password": user.must_change_password}

@router.post("/change-password")
def change_password(body: PasswordBody, user: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash): raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password); user.must_change_password = False
    db.add(AuditLog(actor_user_id=user.id, organization_id=user.organization_id, action="password_changed"))
    db.commit()
    return {"changed": True}


class CollectorKeyBody(BaseModel):
    organization_id: int
    name: str = Field(min_length=2, max_length=100)

@router.post("/collector-keys", status_code=201)
def create_collector_key(body: CollectorKeyBody, actor: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    if actor.role not in {"platform_admin", "org_admin"}: raise HTTPException(403, "Administrator role required")
    if actor.role != "platform_admin" and actor.organization_id != body.organization_id: raise HTTPException(403, "Cross-organization access denied")
    if not db.query(Organization).filter(Organization.id == body.organization_id).first(): raise HTTPException(404, "Organization not found")
    token = __import__('secrets').token_urlsafe(40)
    digest = hashlib.sha256(token.encode()).hexdigest()
    credential = CollectorCredential(organization_id=body.organization_id, name=body.name, token_hash=digest)
    db.add(credential); db.flush(); db.add(AuditLog(actor_user_id=actor.id, organization_id=body.organization_id, action="collector_key_created", details={"credential_id":credential.id,"name":body.name})); db.commit()
    return {"id":credential.id,"name":credential.name,"organization_id":credential.organization_id,"collector_key":token,"warning":"Copy this key now; it cannot be retrieved later."}

@router.delete("/collector-keys/{credential_id}")
def revoke_collector_key(credential_id: int, actor: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    if actor.role not in {"platform_admin", "org_admin"}: raise HTTPException(403, "Administrator role required")
    credential = db.query(CollectorCredential).filter(CollectorCredential.id == credential_id).first()
    if not credential: raise HTTPException(404, "Collector key not found")
    if actor.role != "platform_admin" and actor.organization_id != credential.organization_id: raise HTTPException(403, "Cross-organization access denied")
    credential.revoked_at = datetime.now(timezone.utc); db.add(AuditLog(actor_user_id=actor.id, organization_id=credential.organization_id, action="collector_key_revoked", details={"credential_id":credential.id})); db.commit()
    return {"revoked":True}


class OrganizationBody(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    industry: str | None = None
    country: str | None = None
    timezone: str | None = None
    contact_email: str | None = None

@router.post("/organizations", status_code=201)
def create_organization(body: OrganizationBody, admin: AuthUser = Depends(require_platform_admin), db: Session = Depends(get_db)):
    org = Organization(name=body.name, industry=body.industry, country=body.country, timezone=body.timezone, contact_email=body.contact_email, status="onboarding")
    db.add(org); db.flush(); db.add(OnboardingState(organization_id=org.id)); db.add(AuditLog(actor_user_id=admin.id, organization_id=org.id, action="organization_created")); db.commit()
    return {"id":org.id,"name":org.name,"status":org.status}

@router.post("/users/{user_id}/temporary-password")
def reset_temporary_password(user_id: int, body: TemporaryPasswordBody, actor: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    if actor.role not in {"platform_admin", "org_admin"}: raise HTTPException(403, "Administrator role required")
    target = db.query(AuthUser).filter(AuthUser.id == user_id).first()
    if not target: raise HTTPException(404, "User not found")
    if actor.role != "platform_admin" and actor.organization_id != target.organization_id: raise HTTPException(403, "Cross-organization access denied")
    # The admin supplies a new temporary value; it is immediately hashed and must be changed at next sign-in.
    target.password_hash = hash_password(body.new_password)
    target.must_change_password = True
    db.query(AuthSession).filter(AuthSession.user_id == target.id, AuthSession.revoked_at.is_(None)).update({AuthSession.revoked_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.add(AuditLog(actor_user_id=actor.id, organization_id=target.organization_id, action="temporary_password_reset", details={"target_user_id":target.id}))
    db.commit()
    return {"reset":True,"user_id":target.id,"must_change_password":True,"sessions_revoked":True}

@router.post("/users", status_code=201)
def create_user(body: CreateUserBody, actor: AuthUser = Depends(get_principal), db: Session = Depends(get_db)):
    if actor.role not in {"platform_admin", "org_admin"}: raise HTTPException(403, "Administrator role required")
    org_id = body.organization_id if actor.role == "platform_admin" else actor.organization_id
    if not org_id or not db.query(Organization).filter(Organization.id == org_id).first(): raise HTTPException(404, "Organization not found")
    if body.role not in {"org_admin", "security_analyst", "read_only_viewer"}: raise HTTPException(422, "Invalid organization role")
    if actor.role != "platform_admin" and body.role == "org_admin" and actor.organization_id != org_id: raise HTTPException(403, "Cross-organization access denied")
    if db.query(AuthUser).filter((AuthUser.username == body.username) | (AuthUser.email == body.email if body.email else AuthUser.username == "")).first(): raise HTTPException(409, "Username or email already exists")
    user = AuthUser(username=body.username, email=body.email, password_hash=hash_password(body.temporary_password), role=body.role, organization_id=org_id, must_change_password=True)
    db.add(user); db.flush(); db.add(AuditLog(actor_user_id=actor.id, organization_id=org_id, action="user_created", details={"user_id": user.id, "role": user.role})); db.commit()
    return {"id": user.id, "username": user.username, "role": user.role, "organization_id": org_id, "must_change_password": True}
