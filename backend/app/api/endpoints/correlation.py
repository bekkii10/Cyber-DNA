from fastapi import APIRouter
from app.schemas import CorrelationResponse

router = APIRouter()

@router.post("/correlation/run", response_model=CorrelationResponse)
def run_correlation():
    return CorrelationResponse(
        status="completed",
        incidents_created=2,
        incidents_updated=1
    )

@router.get("/correlation/status")
def get_correlation_status():
    return {"status": "online"}
