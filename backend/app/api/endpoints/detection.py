from fastapi import APIRouter
from app.schemas import AnalyzeRequest, AnalyzeResponse, DetectionStatus

router = APIRouter()

@router.post("/detection/analyze", response_model=AnalyzeResponse)
def analyze_events(payload: AnalyzeRequest):
    return AnalyzeResponse(
        detected=True,
        risk_score=87.0,
        anomaly_score=0.91,
        reason="Test reason",
        explanation="Test explanation"
    )

@router.get("/detection/status", response_model=DetectionStatus)
def get_detection_status():
    return DetectionStatus(
        status="online",
        model="behavioral-model-v1",
        last_analysis="just now"
    )
