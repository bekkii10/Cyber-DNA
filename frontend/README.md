# Cyber DNA — AD Threat Analytics (React + Vite)

    npm install
    npm run dev        # http://localhost:5173
    npm run build

## Backend
All data is requested from `/api/v1` (override with `VITE_API_BASE_URL`). In dev, Vite proxies `/api` to
`http://localhost:8000` (override with `VITE_API_PROXY`). If an endpoint fails, that resource falls back to demo data
and the header pill shows "Demo data". Map backend field names to UI shapes in `src/api/adapters.js`.

## Structure
- `src/styles/` tokens (light/dark), base, layout, components, pages, login
- `src/components/` Sidebar, Header, Login/Splash, Dialogs, ui primitives, SVG charts
- `src/pages/` Overview, Alerts, Incidents, UserBehavior, Hosts, Rules, RiskML, Architecture
- `src/data/` DataContext (fetch + fallback + auto refresh) and mock data
- Demo PIN is `1234` until changed in Settings.
