from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any
from app.api.dependencies import get_db

router = APIRouter()

@router.get("/")
def read_entities(db: Session = Depends(get_db)):
    """
    Retrieve entities (Users/Computers) for timeline investigation.
    """
    # Placeholder for entity fetching logic
    return []
