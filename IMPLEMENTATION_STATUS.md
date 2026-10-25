# Cyber DNA implementation status — 2026-10-24

## Working copy and protection
- Source snapshot extracted from the provided `Cyber_DNA_integrated.zip` into `/mnt/data/cyberdna_work`.
- Original extraction was preserved at `/mnt/data/cyberdna_work_backup_20261024` before edits.
- Initialized Git because the provided archive had no `.git` directory; baseline commit is `Baseline extracted Cyber DNA project` and work branch is `feat/secure-onboarding`.
- This environment is a separate working copy, not the user's Kali filesystem. Copy the delivered ZIP to Kali only after review.

## Implemented
- Added password hashing with PBKDF2-HMAC-SHA256 (310,000 rounds), random salts, database-backed opaque sessions, eight-hour expiry, HttpOnly/SameSite=Lax cookie, logout revocation, and forced temporary-password change.
- Added one-time first-platform-admin bootstrap guarded by `CYBERDNA_BOOTSTRAP_SECRET`; public self-registration is not exposed.
- Added administrator-provisioned accounts, organization creation, administrator temporary-password reset (revokes existing sessions), collector key creation/revocation, and audit records without storing secrets.
- Added organizations, onboarding state, configurable pricing rules, collector credentials, and audit log tables.
- Added additive migration for `organization_id` on existing telemetry/detection tables. First bootstrap assigns pre-tenant legacy records to the first organization; subsequent tenant queries are ORM-scoped. New ingested data inherits the collector key/session organization context.
- Protected existing data/configuration routers with server-side authentication; read-only viewers cannot mutate data. Collector ingestion POSTs require an organization-scoped `X-Collector-Key`; status reads may use an authenticated operator session.
- Added persistent onboarding APIs and a frontend onboarding wizard for organization details, AD assessment, estimates, plan approval request, collector guidance, and live health/collector checks.
- Added pricing calculations that refuse to produce estimates until a platform administrator configures all required pricing rules. No prices are invented.
- Connected the login UI to backend authentication and added forced password-change UI and server logout.
- Added tests for password hashing and tenant query isolation across events, hosts, alerts, incidents, and findings.

## Verification performed
- `PYTHONPATH=. pytest -q app/tests`: **33 passed** (6 existing Pydantic deprecation warnings).
- `python -m compileall -q app`: passed.
- App import/route registration smoke check: passed.
- Manual FastAPI TestClient smoke test: bootstrap returned 201, unauthenticated `/events` returned 401, login returned 200 with session cookie, `/auth/me` returned 200, onboarding loaded, logout returned 200.
- Frontend production build and Vitest suite **could not run**: `npm ci` failed because the environment cannot resolve/download packages from `registry.npmjs.org` (`EAI_AGAIN`); offline install reports missing cached `yallist-3.1.1`. Vite/Vitest binaries therefore are unavailable. No dependency or lockfile changes were made.

## Remaining blockers / cautions
- Email-based self-service password reset and MFA are not implemented because no mail/identity provider is configured. Administrator-issued temporary-password reset is implemented.
- A real collector must be configured with a provisioned `X-Collector-Key`, and network transport should be HTTPS. This work does not install or configure an AD collector on a customer domain controller.
- Activation is deliberately not auto-approved by a customer click. It stays pending unless the platform administrator explicitly activates it and the backend sees recent ingested events. Broader operational verification (event parsing, detection execution, AI provider live connectivity, and collector host identity) still needs deployment-specific integration checks.
- The database migration is additive and non-destructive. Back up `backend/cyberdna.db` before first launch. Existing telemetry is assigned to the first bootstrap organization because the pre-tenant database represented one local deployment; review this assumption if the database was manually populated with mixed customer data.
- The current environment could not verify browser rendering, responsive behavior, or the previously reported white-screen issue because frontend dependencies could not be installed.
