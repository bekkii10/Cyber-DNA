# Cyber DNA repository audit and change report

## Phase A — Audit of the supplied `Cyber_DNA_integrated.zip`

### Architecture found
- Frontend: React 18 + Vite, with existing Overview, Alerts, Incidents, User Behavior, Hosts, Detection Rules, Risk & ML, and Architecture pages.
- Frontend data: a shared `DataProvider` calls the FastAPI API and falls back to empty states unless `VITE_DEMO_MODE=true`.
- Backend: FastAPI routers for health, dashboard, collector, events, alerts, incidents, users, hosts, rules, detection, correlation, and the AI analyst.
- Persistence: SQLAlchemy models and SQLite by default; `Base.metadata.create_all()` is called on backend startup.
- Detection: rule engine plus an Isolation Forest artifact and ML detection service are present. Availability and compatibility must be confirmed through `/api/v1/detection/status`; the artifact alone is not proof of end-to-end operational monitoring.
- AI explanations: backend `/api/v1/analyst/ask`; frontend `AnalystExplanation` component previously used on expanded alert details only.
- Notebook: a floating security notebook with a resizable/maximizable window and a separate in-window drawer.

### High-priority gaps found
1. **Authentication is not production authentication.** `frontend/src/App.jsx` stores `cyberdna-session=1` in browser session storage and grants access locally. `Login.jsx` explicitly says the screen is a demo gate. Backend API routes have no authentication middleware or trusted organization context.
2. **No multi-tenant isolation model is present.** Existing business tables do not consistently carry organization IDs, and routes do not derive tenant scope from authenticated identity. Do not expose this build as a multi-customer production service.
3. **Onboarding, persisted progress, pricing approvals, organization roles, collector-to-tenant registration, and activation workflow are not implemented in the supplied ZIP.** Implementing only frontend steps would create a misleading and insecure appearance, so this report does not claim those capabilities were completed.
4. **Risk & ML page copy was stale.** It said ML was not integrated and described a planned engine even though the backend contains an ML service and status endpoint. The page was changed to display the backend-reported detection status and explicitly qualify model limitations.
5. **AI explanations were not consistently placed.** Expanded alerts had an AI explanation, but User Behavior, Risk & ML, and Incidents did not. The existing explanation component is now added beneath their relevant evidence/summary areas.
6. **Narrow content width can occur with the expanded left navigation.** The master/detail pages and 12-column panels used a breakpoint based only on viewport width, which can leave too little usable content width when the desktop sidebar is visible. Responsive stacking now starts earlier.

## Phase B — Plan and compatibility

- Preserve the existing React/FastAPI stack and current API paths.
- Fix the presentation issues without replacing the dashboard with mock screens.
- Reuse the existing backend detection-status and AI analyst APIs.
- Keep the production authentication and multi-tenant work as a separate security-critical implementation phase; it requires identity/session design, schema migrations, tenant-scoped query changes on every data route, role checks, collector identity, and cross-tenant tests.

## Changes made in this revision
- Added `AnalystExplanation` to User Behavior, Risk & ML, and Incidents, using each selected record as context and asking for concise, evidence-grounded analysis.
- Updated Risk & ML status copy to reflect actual backend detection status when the API is reachable. It distinguishes rule-only from rule-plus-ML availability and avoids treating stored risk scores as model predictions.
- Adjusted responsive breakpoints so detail pages and panel grids stack earlier when the usable content area is constrained by the expanded navigation.
- Added this audit and limitation report.

## Verification status
- The frontend production build was attempted but could not run because `vite` is not installed in the extracted environment. `npm ci --ignore-scripts` did not finish within the available environment timeout. Therefore no frontend build or browser test is claimed as passing.
- Backend tests were not run in this environment; dependency availability is not confirmed here.
- No live OpenAI request, real collector connection, tenant-isolation test, or end-to-end onboarding test was performed.

## Required next security phase before production
1. Implement administrator-provisioned accounts, password hashing, secure sessions/tokens, password change/reset, and server-side role authorization.
2. Add organizations and membership/role relations through safe migrations; scope every data query and collector credential to an authenticated tenant.
3. Add tenant-isolation tests for alerts, incidents, events, hosts, user behavior, rules, analytics, AI context retrieval, and collector endpoints.
4. Persist onboarding and assessment state in the database; add admin-managed pricing configuration and immutable quote/plan snapshots.
5. Verify actual collector heartbeats and ingested events before activation; report detection and AI status independently.
6. Install frontend dependencies, run `npm test` and `npm run build`, run backend `pytest`, then perform browser/API integration tests.
