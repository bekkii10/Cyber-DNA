"""Authentication primitives: PBKDF2 password hashes and opaque database-backed sessions."""
import hashlib, hmac, secrets
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import AuthUser, AuthSession

SESSION_COOKIE = "cyberdna_session"

def hash_password(password: str, salt: bytes | None = None) -> str:
    if len(password) < 12:
        raise ValueError("Password must be at least 12 characters")
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${salt.hex()}${digest.hex()}"

def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, rounds, salt_hex, digest_hex = encoded.split("$")
        if scheme != "pbkdf2_sha256": return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)).hex()
        return hmac.compare_digest(actual, digest_hex)
    except (ValueError, TypeError): return False

def create_session(db: Session, user: AuthUser, hours: int = 8) -> str:
    token = secrets.token_urlsafe(48)
    digest = hashlib.sha256(token.encode()).hexdigest()
    db.add(AuthSession(token_hash=digest, user_id=user.id, expires_at=datetime.now(timezone.utc)+timedelta(hours=hours)))
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return token

def get_principal(request: Request, db: Session = Depends(get_db)) -> AuthUser:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "): token = auth[7:].strip()
    if not token: raise HTTPException(status_code=401, detail="Authentication required")
    digest = hashlib.sha256(token.encode()).hexdigest()
    row = db.query(AuthSession).filter(AuthSession.token_hash == digest, AuthSession.revoked_at.is_(None)).first()
    now = datetime.now(timezone.utc)
    if not row: raise HTTPException(status_code=401, detail="Invalid session")
    expiry = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if expiry <= now:
        row.revoked_at = now; db.commit()
        raise HTTPException(status_code=401, detail="Session expired")
    db.info["organization_id"] = row.user.organization_id if row.user else None
    if not row.user or not row.user.is_active: raise HTTPException(status_code=403, detail="Account disabled")
    return row.user

def require_platform_admin(user: AuthUser = Depends(get_principal)) -> AuthUser:
    if user.role != "platform_admin": raise HTTPException(status_code=403, detail="Platform administrator role required")
    return user


def require_collector(request: Request, db: Session = Depends(get_db)):
    """Accept an authenticated operator session or an organization-scoped collector key."""
    ingestion_request = request.method.upper() == "POST" and (request.url.path.endswith("/collector/events") or request.url.path.endswith("/collector/heartbeat"))
    if not ingestion_request:
        try:
            return get_principal(request, db)
        except HTTPException as exc:
            if exc.status_code != 401:
                raise
    token = request.headers.get("x-collector-key", "")
    if not token:
        raise HTTPException(status_code=401, detail="Collector authentication required")
    from app.db.models import CollectorCredential
    digest = hashlib.sha256(token.encode()).hexdigest()
    credential = db.query(CollectorCredential).filter(CollectorCredential.token_hash == digest, CollectorCredential.revoked_at.is_(None)).first()
    if not credential:
        raise HTTPException(status_code=401, detail="Invalid collector key")
    db.info["organization_id"] = credential.organization_id
    return credential


def require_api_user(request: Request, user: AuthUser = Depends(get_principal)) -> AuthUser:
    if request.method.upper() not in {"GET", "HEAD", "OPTIONS"} and user.role == "read_only_viewer":
        raise HTTPException(status_code=403, detail="Read-only viewer cannot modify platform data")
    return user
