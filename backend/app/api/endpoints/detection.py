from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Alert, DetectionRule, Event, DetectionFinding
from app.services.detection_engine import ensure_detection_rules, run_detection
from app.services.ml_detection import status as ml_status

router = APIRouter()

@router.post("/detection/run")
def run_detection_endpoint(db: Session = Depends(get_db)):
    return run_detection(db)

@router.get("/detection/status")
def get_detection_status(db: Session = Depends(get_db)):
    ensure_detection_rules(db); db.commit()
    rules = db.query(DetectionRule).order_by(DetectionRule.id.asc()).all()
    ml = ml_status()
    ml_active = bool(ml["enabled"] and ml["available"])
    return {
        "status": "available" if any(r.enabled for r in rules) else "disabled",
        "engine": "rule_and_ml" if ml_active else "rule_only",
        "rules_loaded": len(rules),
        "rules_enabled": sum(r.enabled for r in rules),
        "events_available": db.query(Event).count(),
        "alerts_total": db.query(Alert).count(),
        "findings_total": db.query(DetectionFinding).count(),
        "ml_status": "available" if ml["available"] else ("disabled" if not ml["enabled"] else "unavailable"),
        "model": ml["model"],
        "model_version": ml["model_version"],
        "ml_compatibility": ml["compatibility"],
        "ml_warning": ml["warning"],
        "ml_features": ml["feature_names"],
        "ml_feature_transform": ml["feature_transform"],
        "ml_score_semantics": ml["score_semantics"],
    }


@router.get("/detection/findings")
def get_detection_findings(limit: int = 50, engine_type: str | None = None, db: Session = Depends(get_db)):
    """Return persisted rule/ML/correlation provenance, newest first."""
    limit = max(1, min(int(limit), 200))
    query = db.query(DetectionFinding)
    if engine_type in {"rule", "ml", "correlated"}:
        query = query.filter(DetectionFinding.engine_type == engine_type)
    rows = query.order_by(DetectionFinding.timestamp.desc(), DetectionFinding.id.desc()).limit(limit).all()
    return {
        "items": [{
            "id": row.id,
            "engine_type": row.engine_type,
            "detection_name": row.detection_name,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "score": row.score,
            "predicted_class": row.predicted_class,
            "model_version": row.model_version,
            "evidence": row.evidence or {},
            "feature_values": row.feature_values or {},
            "reasons": row.reasons or [],
            "alert_id": row.alert_id,
            "incident_id": row.incident_id,
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        } for row in rows],
        "count": len(rows),
        "engine_type": engine_type,
        "ml_status": ml_status(),
    }
