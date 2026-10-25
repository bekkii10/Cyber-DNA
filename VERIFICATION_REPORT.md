# Cyber DNA Verification Report

## Executed backend tests
Command:

`python -m pytest -q`

Result:

**31 passed, 6 warnings**

The suite covers:
- rule-based detection,
- failed-logon burst/password-spray behavior,
- static Windows event rules,
- ingestion and duplicate handling,
- rule/ML combined operation,
- persisted ML findings and provenance,
- analyst evidence retrieval,
- API route wiring,
- model artifact status,
- exact v25 transform behavior,
- real model loading and scoring on a consecutive hourly window.

## Backend import/OpenAPI smoke test
Executed:

`python -c "import app.main; print(app.main.app.title); print(app.main.app.openapi()['paths'].get('/api/v1/analyst/ask') is not None)"`

Result:
- application imported successfully;
- `/api/v1/analyst/ask` is present in OpenAPI.

## Frontend
The integrated frontend is based on the Claude package and was inspected/merged, but a production build could not be executed in this environment because the frontend dependency installation did not complete and the resulting `node_modules` lacked the Vite executable (`vite: not found`).

Therefore:
- frontend build: **UNTESTED**
- frontend Vitest suite: **UNTESTED**
- browser/end-to-end UI: **UNTESTED**

This is not reported as a pass.

## Provider
No external AI credential was supplied/configured in the test environment. Deterministic evidence fallback behavior was tested by the backend suite. Live external provider connectivity was not tested.

## Security limitation
The supplied backend has no authentication middleware. The frontend login remains explicitly labeled as a demo gate. This integrated build does not claim production authentication or authorization.
