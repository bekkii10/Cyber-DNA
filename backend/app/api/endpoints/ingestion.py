from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.api.dependencies import get_db
from app.services.parser import ParserService

router = APIRouter()

@router.post("/")
async def ingest_logs(request: Request, db: Session = Depends(get_db)):
    """
    Endpoint to receive raw logs from Winlogbeat.
    Winlogbeat sends data in bulk usually, depending on logstash output config.
    """
    try:
        payload = await request.json()
        
        # Winlogbeat might send a single JSON object or a list
        if isinstance(payload, dict):
            events = [payload]
        elif isinstance(payload, list):
            events = payload
        else:
            raise HTTPException(status_code=400, detail="Invalid payload format")
        
        # Process and normalize events
        ParserService.process_raw_events(db, events)
        
        return {"status": "success", "processed_count": len(events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
