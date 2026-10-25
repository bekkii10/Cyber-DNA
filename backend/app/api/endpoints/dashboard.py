from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.db.models import Event, Alert, Incident, User, Computer

router = APIRouter()

@router.get('/dashboard/overview')
def get_dashboard_overview(db: Session = Depends(get_db)):
    events_count = db.query(Event).count()
    active_alerts = db.query(Alert).filter(Alert.status.notin_(['resolved', 'Resolved'])).count()
    open_incidents = db.query(Incident).filter(Incident.status.notin_(['resolved', 'Resolved', 'closed', 'Closed'])).count()
    high_risk_users = db.query(User).filter(User.risk_score >= 70).count()
    monitored_hosts = db.query(Computer).count()
    recent_events = db.query(Event).order_by(Event.timestamp.desc()).limit(10).all()
    recent_alerts = db.query(Alert).order_by(Alert.time.desc()).limit(10).all()
    distribution_counts = Counter()
    for row in db.query(Event.event_id, func.count(Event.id)).group_by(Event.event_id).all():
        eid, count = row
        if eid in (4624, 4625, 4634, 4647, 4768, 4769, 4771): category = 'Logon events'
        elif eid in (4688, 4689, 4672, 4673): category = 'Process and privilege events'
        elif eid in (4720, 4722, 4725, 4726, 4728, 4732, 4756): category = 'Account changes'
        elif eid in (5156, 5157, 5158): category = 'Network events'
        else: category = 'Other events'
        distribution_counts[category] += count
    distribution = [{'label': k, 'value': v} for k, v in distribution_counts.items()]
    return {
        'events_count': events_count, 'active_alerts': active_alerts,
        'open_incidents': open_incidents, 'high_risk_users': high_risk_users,
        'monitored_hosts': monitored_hosts, 'event_activity': [],
        'risk_distribution': {}, 'distribution': distribution,
        'recent_events': [ {'id': e.id, 'timestamp': e.timestamp, 'event_id': e.event_id, 'username': e.username, 'computer': e.computer, 'source_ip': e.source_ip} for e in recent_events ],
        'recent_alerts': [ {'id': a.id, 'severity': a.severity, 'rule': a.rule, 'time': a.time, 'user': a.user, 'host': a.host} for a in recent_alerts ]
    }

@router.get('/dashboard/activity')
def get_dashboard_activity(hours: int = Query(default=24, ge=1, le=720), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    bucket_hours = 1 if hours <= 48 else (24 if hours > 168 else 6)
    count = min(48, max(1, int(hours / bucket_hours)))
    labels, values = [], []
    for i in range(count - 1, -1, -1):
        end = now - timedelta(hours=i * bucket_hours)
        start = end - timedelta(hours=bucket_hours)
        total = db.query(Event).filter(Event.timestamp >= start, Event.timestamp < end).count()
        labels.append(start.strftime('%H:00') if bucket_hours == 1 else start.strftime('%m-%d'))
        values.append(total)
    return {'hours': hours, 'labels': labels, 'series': [{'key': 'events', 'label': 'Events', 'values': values}], 'points': [{'time': l, 'count': v} for l, v in zip(labels, values)]}
