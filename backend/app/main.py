from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.endpoints import ingestion, alerts, entities
from app.db.database import engine, Base

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
app.include_router(ingestion.router, prefix=settings.API_V1_STR + "/ingest", tags=["ingestion"])
app.include_router(alerts.router, prefix=settings.API_V1_STR + "/alerts", tags=["alerts"])
app.include_router(entities.router, prefix=settings.API_V1_STR + "/entities", tags=["entities"])

@app.get("/")
def root():
    return {"message": "Welcome to the Cyber-DNA Platform API"}
