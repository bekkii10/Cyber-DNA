
from __future__ import annotations
from datetime import timedelta, timezone
from sqlalchemy.orm import Session
from app.db.models import Alert, Incident, DetectionFinding


def _utc(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def correlate_recent(db: Session, lookback_minutes: int = 15) -> dict:
    alerts = db.query(Alert).filter(Alert.time.isnot(None)).order_by(Alert.time.asc(), Alert.id.asc()).all()
    incidents_created = incidents_updated = 0
    seen_finding_keys = set()
    for alert in alerts:
        t = _utc(alert.time)
        if t is None:
            continue
        # Correlate alerts that share a user, host, or source IP in a short window.
        candidates = []
        for other in alerts:
            if other.id == alert.id or other.time is None:
                continue
            ot = _utc(other.time)
            if abs((ot - t).total_seconds()) > lookback_minutes * 60:
                continue
            shared = (
                (alert.user and other.user and alert.user == other.user and not alert.user.startswith("Multiple accounts")) or
                (alert.host and other.host and alert.host == other.host) or
                (alert.ip and other.ip and alert.ip == other.ip)
            )
            if shared:
                candidates.append(other)
        group = [alert] + candidates
        group = list({a.id: a for a in group}.values())
        sources = {("rule" if a.rule_id else "ml") for a in group}
        if len(group) < 2:
            continue
        key_parts = sorted(a.id for a in group)
        key = "INC-" + "-".join(key_parts)[:180]
        incident = db.query(Incident).filter(Incident.id == key).first()
        if incident is None:
            first = min(_utc(a.time) for a in group)
            last = max(_utc(a.time) for a in group)
            max_score = max(float(a.score or 0) for a in group)
            risk = "critical" if max_score >= 90 else "high" if max_score >= 75 else "medium"
            incident = Incident(
                id=key, title="Correlated security findings",
                risk=risk, score=max_score, status="OPEN",
                first_seen=first, last_seen=last,
            )
            db.add(incident)
            db.flush()
            incidents_created += 1
        else:
            incident.last_seen = max([_utc(a.time) for a in group] + [_utc(incident.last_seen)])
            incident.score = max(float(incident.score or 0), max(float(a.score or 0) for a in group))
            incidents_updated += 1
        for a in group:
            a.incident = incident
        # Record a correlation finding once per incident.
        fk = f"correlated:{incident.id}"
        if fk not in seen_finding_keys and db.query(DetectionFinding).filter_by(finding_key=fk).first() is None:
            db.add(DetectionFinding(
                finding_key=fk,
                engine_type="correlated",
                detection_name="Correlated security findings",
                entity_type="user/host",
                entity_id=alert.user or alert.host or alert.ip,
                score=incident.score,
                evidence={"alert_ids": [a.id for a in group]},
                reasons=[
                    "Multiple persisted detections share an account, host, or source IP within the correlation window.",
                    f"Detection sources present: {', '.join(sorted(sources))}.",
                ],
                incident_id=incident.id,
                timestamp=incident.last_seen,
            ))
            seen_finding_keys.add(fk)
    db.commit()
    return {"status": "completed", "incidents_created": incidents_created, "incidents_updated": incidents_updated}
