from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas import AnalystRequest, AnalystResponse
from app.services.analyst import ask, provider_status
from app.services.ml_detection import status as ml_status

router = APIRouter()


@router.get("/analyst/status")
def analyst_status():
    """Report local provider configuration without making a billable network request."""
    return {**provider_status(check_connectivity=False), "ml": ml_status()}


@router.post("/analyst/status/check")
def analyst_status_check():
    """Explicitly perform a small live Responses API request to verify credentials/model access."""
    return {**provider_status(check_connectivity=True), "ml": ml_status()}


@router.post("/analyst/ask", response_model=AnalystResponse)
def analyst_ask(request: AnalystRequest, db: Session = Depends(get_db)):
    # Preserve truthful provider status/error codes for the UI/client.
    return ask(db, request)
