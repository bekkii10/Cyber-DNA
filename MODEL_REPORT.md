# Cyber DNA v25 Model Report

## Artifact
`backend/models/cyberdna_v25_isolation_forest.joblib`

## Algorithm
scikit-learn `IsolationForest`, 300 estimators, random state 2026, `contamination="auto"`.

## Features and order
1. successful_logons
2. failed_logons
3. logoffs
4. explicit_credential_events
5. privilege_events
6. process_starts
7. kerberos_tgt_events
8. kerberos_service_ticket_events
9. credential_validation_events

## Transformation
The supplied notebook's v25 training code uses consecutive user/host hourly deltas, signed `log1p`, training-derived per-feature scales, clipping to [-5, 5], then Isolation Forest inference.

The packaged config supplies these saved scales and thresholds. The backend uses those values; it does not refit them online.

## Score semantics
`anomaly_score = -model.decision_function(X)`. Higher values are more anomalous. This is not attack probability, confidence, or proof of compromise.

Saved calibration thresholds:
- p99: 0.10532385168133324
- p99.5: 0.1226613500301712

The integration classifies an anomaly at the saved p99 threshold.

## Notebook verification evidence
The supplied notebook reports reproduction of 430,195 saved scored rows with maximum absolute anomaly-score difference approximately 9.99e-17, with the original v25 artifacts left unmodified.

## Limitation
The notebook's own completion report states that collector feature mapping was not verified. Live inference therefore uses an explicit compatibility mapping for standard Windows Security event IDs. This is a real limitation and is surfaced in health status.
