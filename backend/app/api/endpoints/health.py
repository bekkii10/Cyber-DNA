from fastapi import APIRouter
from app.schemas import HealthCheck

router = APIRouter()

@router.get("/health", response_model=HealthCheck)
def get_health():
    return HealthCheck(
        status="ok",
        database="connected",
        collector="online",
        ml_engine="online"
    )
