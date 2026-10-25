from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base, migrate_tenant_columns

from app.api.endpoints import (
    health,
    dashboard,
    collector,
    events,
    alerts,
    incidents,
    users,
    hosts,
    rules,
    detection,
    correlation,
    analyst
)
from app.api.endpoints import auth, onboarding
from app.services.security import require_api_user

# Import models before creating tables.
from app.db import models  # noqa: F401
from app.services.detection_engine import ensure_detection_rules
from sqlalchemy.orm import Session
Base.metadata.create_all(bind=engine)
migrate_tenant_columns()

# Register missing rule definitions on startup. Existing enabled/disabled choices are preserved.
with Session(engine) as db:
    ensure_detection_rules(db)
    db.commit()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Cyber DNA Active Directory event analytics API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Restrict browser access to local development origins by default.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Collector-Key"],
)

# Authentication and onboarding endpoints are intentionally public at router level only where required.
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(onboarding.router, prefix=settings.API_V1_STR)

# Protect all existing data/configuration API routers server-side. Health stays public for probes.
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["health"])
app.include_router(dashboard.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["dashboard"])
app.include_router(collector.router, prefix=settings.API_V1_STR, tags=["collector"])
app.include_router(events.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["events"])
app.include_router(alerts.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["alerts"])
app.include_router(incidents.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["incidents"])
app.include_router(users.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["users"])
app.include_router(hosts.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["hosts"])
app.include_router(rules.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["rules"])
app.include_router(detection.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["detection"])
app.include_router(correlation.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["correlation"])
app.include_router(analyst.router, prefix=settings.API_V1_STR, dependencies=[Depends(require_api_user)], tags=["analyst"])

@app.get("/")
def root():
    return {"message": "Welcome to the Cyber-DNA Platform API"}
