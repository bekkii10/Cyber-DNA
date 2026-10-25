from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.db.models import Event
from app.services.ml_detection import status as ml_status
from app.services.analyst import provider_status

router = APIRouter()

@router.get('/health')
def get_health(db: Session = Depends(get_db)):
    try:
        db.execute(text('SELECT 1'))
        database = 'online'
    except Exception:
        database = 'offline'
    latest = db.query(Event.timestamp).order_by(Event.timestamp.desc()).first() if database == 'online' else None
    last_event = latest[0] if latest else None
    if last_event and last_event.tzinfo is None:
        last_event = last_event.replace(tzinfo=timezone.utc)
    collector = 'online' if last_event and last_event >= datetime.now(timezone.utc) - timedelta(minutes=2) else 'offline'
    ml = ml_status()
    return {'status': 'ok' if database == 'online' else 'degraded', 'database': database,
            'collector': collector, 'ml_engine': 'available' if ml['available'] else ('disabled' if not ml['enabled'] else 'unavailable'),
            'ml_model': ml['model'], 'ml_compatibility': ml['compatibility'], 'ml_reason': ml['warning'],
            'ai_provider': provider_status(check_connectivity=False),
            'last_event': last_event}
