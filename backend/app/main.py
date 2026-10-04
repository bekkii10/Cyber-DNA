from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base

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
    correlation
)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["health"])
app.include_router(dashboard.router, prefix=settings.API_V1_STR, tags=["dashboard"])
app.include_router(collector.router, prefix=settings.API_V1_STR, tags=["collector"])
app.include_router(events.router, prefix=settings.API_V1_STR, tags=["events"])
app.include_router(alerts.router, prefix=settings.API_V1_STR, tags=["alerts"])
app.include_router(incidents.router, prefix=settings.API_V1_STR, tags=["incidents"])
app.include_router(users.router, prefix=settings.API_V1_STR, tags=["users"])
app.include_router(hosts.router, prefix=settings.API_V1_STR, tags=["hosts"])
app.include_router(rules.router, prefix=settings.API_V1_STR, tags=["rules"])
app.include_router(detection.router, prefix=settings.API_V1_STR, tags=["detection"])
app.include_router(correlation.router, prefix=settings.API_V1_STR, tags=["correlation"])

@app.get("/")
def root():
    return {"message": "Welcome to the Cyber-DNA Platform API"}
