# Endpoints to create/update

## Health
- GET /api/health

## Dashboard
- GET /api/dashboard/overview
- GET /api/dashboard/activity

## Collector
- POST /api/collector/events
- GET /api/collector/status
- POST /api/collector/heartbeat

## Events
- GET /api/events
- GET /api/events/{event_id}
- GET /api/events/stats

## Alerts
- GET /api/alerts
- GET /api/alerts/{alert_id}
- PATCH /api/alerts/{alert_id}/seen
- POST /api/alerts/mark-all-seen
- GET /api/alerts/unseen/count

## Incidents
- GET /api/incidents
- GET /api/incidents/{incident_id}
- PATCH /api/incidents/{incident_id}/status

## Users
- GET /api/users
- GET /api/users/{username}
- GET /api/users/{username}/events
- GET /api/users/{username}/alerts
- GET /api/users/{username}/risk

## Hosts
- GET /api/hosts
- GET /api/hosts/{hostname}
- GET /api/hosts/{hostname}/events
- GET /api/hosts/{hostname}/alerts

## Rules
- GET /api/rules
- GET /api/rules/{rule_id}
- GET /api/rules/{rule_id}/stats

## Detection / Correlation (Phase 2)
- GET /api/users/{username}/behavior
- POST /api/detection/analyze
- GET /api/detection/status
- POST /api/correlation/run
- GET /api/correlation/status
