# Cyber DNA Integration Report

## Source selection
- Backend/detection/database/model artifacts: current `cyberdna_verify` package.
- Primary frontend: Claude advanced frontend package.
- Alert notification/read-state behavior: merged from the current Cyber DNA frontend.
- Original training evidence: supplied `CyberDNA_Model_Training (1)(2).ipynb`.

## ML model selected
The integrated model is `backend/models/cyberdna_v25_isolation_forest.joblib`, the v25 Isolation Forest identified in the supplied notebook and packaged artifact set.

The notebook defines the v25 transform as:
1. aggregate counts by user/host/hour,
2. require a consecutive previous hour,
3. calculate signed hourly deltas,
4. apply signed `log1p`,
5. divide by saved per-feature scales,
6. clip each transformed feature to [-5, 5],
7. score with the trained 300-tree Isolation Forest.

The backend now reproduces that transformation for live event windows. It uses the saved calibration threshold `model_score_p99` to classify an anomaly. The anomaly score is `-decision_function`; it is not a probability or confidence value.

## Important limitation
The notebook explicitly records that the authoritative collector event-ID mapping was not yet validated. The backend therefore uses a documented Windows Security event-ID compatibility mapping. The system reports this limitation in ML health status instead of claiming full training/collector equivalence.

## Detection pipeline
Collector -> FastAPI ingestion -> database -> rule detection + v25 ML inference -> correlation -> alerts/incidents -> frontend/AI Analyst.

Rule detection remains independent. ML failures do not suppress rule detection.

## Frontend
Claude's advanced frontend is the primary UI implementation, including its advanced AI Analyst, notebook, assistant settings, interaction system, and pages. Current Cyber DNA alert notification behavior was merged into the Header/DataContext/Alerts flow:
- persistent read state,
- new-alert detection,
- notification-to-alert navigation,
- refresh-safe notification behavior,
- backend `/seen` synchronization,
- alert status actions.

## AI Analyst
The existing `/api/v1/analyst/ask` backend is retained. It retrieves database evidence for alerts, incidents, users, hosts, rules, events, and ML findings. The advanced frontend assistant calls that endpoint. The alert explanation component now generates a concise explanation when a record is selected and provides a `Generate More` expansion request.

The external AI provider remains optional. When it is not configured, the backend returns an explicitly labeled deterministic evidence summary.

## No fabricated ML status
ML health is based on actual artifact loading and feature validation. The frontend uses real backend data by default (`VITE_DEMO_MODE=false`).
