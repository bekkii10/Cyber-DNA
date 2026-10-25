# Kali Linux Run Instructions

## 1. Extract
```bash
unzip Cyber_DNA_integrated.zip
cd Cyber_DNA_integrated
```

## 2. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m pytest -q
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API is served under `/api/v1`.

## 3. Frontend
In a second terminal:
```bash
cd Cyber_DNA_integrated/frontend
npm install
cp .env.example .env
npm run build
npm run dev -- --host 0.0.0.0
```

The frontend expects:
`VITE_API_BASE_URL=/api/v1`

Keep:
`VITE_DEMO_MODE=false`

## 4. Optional external AI
Put the provider key only in `backend/.env`. Never put it in `frontend/.env`.

The AI Analyst works without an external key by returning an explicitly labeled evidence-based fallback. Configure a supported provider/model only after verifying access.

## 5. Database
SQLite is the default for this package. PostgreSQL settings are available in `backend/.env.example`.

## Secure onboarding implementation — first launch

**Back up the database first:**

```bash
cd ~/Downloads/Cyber_DNA_integrated
cp backend/cyberdna.db "backend/cyberdna.db.backup-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
```

Create the backend environment file from the template if it does not exist, then edit it:

```bash
cd ~/Downloads/Cyber_DNA_integrated/backend
cp -n .env.example .env
python -c 'import secrets; print(secrets.token_urlsafe(48))'
nano .env
```

Set `CYBERDNA_BOOTSTRAP_SECRET` to a fresh random value from the command above. Keep the value private. For local HTTP development use `CYBERDNA_COOKIE_SECURE=false`; behind HTTPS set it to `true`. Never set `OPENAI_API_KEY` in the frontend `.env`.

Start the backend from the backend directory so the existing `app.*` imports resolve:

```bash
cd ~/Downloads/Cyber_DNA_integrated/backend
source ../.venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Create the first platform administrator once using `POST /api/v1/auth/bootstrap` with the configured bootstrap secret, a username, a password of at least 12 characters, and the initial organization name. The endpoint disables itself after the first platform administrator is created. Do not use sample credentials from documentation; no default password exists. After bootstrap, sign in through the frontend. A temporary password forces a password change.

Start the frontend in a second terminal:

```bash
cd ~/Downloads/Cyber_DNA_integrated/frontend
npm ci
npm run dev -- --host 127.0.0.1
```

The frontend Vite proxy forwards `/api` to `http://127.0.0.1:8000`. `npm ci` needs access to the npm registry; if it fails with DNS `EAI_AGAIN`, restore network/DNS connectivity and retry without changing `package-lock.json`.

Run backend tests:

```bash
cd ~/Downloads/Cyber_DNA_integrated/backend
source ../.venv/bin/activate
PYTHONPATH=. pytest -q app/tests
```

Collector setup: an authenticated administrator provisions an organization-scoped key at `POST /api/v1/auth/collector-keys`. Store the returned key only on the collector host and send it in the `X-Collector-Key` header when posting to `/api/v1/collector/events` or `/api/v1/collector/heartbeat`. Treat the key like a password and revoke it when compromised.
