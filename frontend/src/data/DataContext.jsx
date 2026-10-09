import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, ENDPOINTS } from '../api/client';
import { adaptAlert, adaptHost, adaptIncident, adaptRule, adaptUser, asList } from '../api/adapters';
import * as mock from './mock';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const LISTS = {
  alerts: [ENDPOINTS.alerts, adaptAlert],
  incidents: [ENDPOINTS.incidents, adaptIncident],
  users: [ENDPOINTS.users, adaptUser],
  hosts: [ENDPOINTS.hosts, adaptHost],
  rules: [ENDPOINTS.rules, adaptRule],
};

// Loads every dashboard resource from /api/v1. Any endpoint that fails falls back to demo data
// so the UI is always usable; `sources` records which endpoints are live.
export function DataProvider({ range, autoRefresh, children }) {
  const [data, setData] = useState({
    alerts: mock.alerts, incidents: mock.incidents, users: mock.users, hosts: mock.hosts, rules: mock.rules,
    overview: mock.overview, detection: mock.detection, correlation: mock.correlation, activity: mock.activitySeries(range),
  });
  const [sources, setSources] = useState({});
  const [updated, setUpdated] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [seen, setSeen] = useState(() => new Set());
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const load = useCallback(async () => {
    setLoading(true);
    const next = {}; const src = {};
    const tasks = [
      ...Object.entries(LISTS).map(async ([key, [path, adapt]]) => {
        try { const list = asList(await apiGet(path)); if (!list) throw new Error('shape'); next[key] = list.map(adapt); src[key] = 'live'; }
        catch { next[key] = mock[key]; src[key] = 'demo'; }
      }),
      (async () => { try { const o = await apiGet(ENDPOINTS.overview); if (!o || typeof o !== 'object') throw new Error('shape'); next.overview = { ...mock.overview, ...o }; src.overview = 'live'; } catch { next.overview = mock.overview; src.overview = 'demo'; } })(),
      (async () => { try { const a = await apiGet(ENDPOINTS.activity, { range: rangeRef.current }); if (!a?.labels || !a?.series) throw new Error('shape'); next.activity = a; src.activity = 'live'; } catch { next.activity = mock.activitySeries(rangeRef.current); src.activity = 'demo'; } })(),
      (async () => { try { next.detection = { ...mock.detection, ...(await apiGet(ENDPOINTS.detection)) }; src.detection = 'live'; } catch { next.detection = mock.detection; src.detection = 'demo'; } })(),
      (async () => { try { next.correlation = { ...mock.correlation, ...(await apiGet(ENDPOINTS.correlation)) }; src.correlation = 'live'; } catch { next.correlation = mock.correlation; src.correlation = 'demo'; } })(),
    ];
    await Promise.all(tasks);
    setData((d) => ({ ...d, ...next }));
    setSources((s) => ({ ...s, ...src, events: s.events || 'demo' }));
    setUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, range]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const alerts = useMemo(() => data.alerts.map((a) => (overrides[a.id] ? { ...a, status: overrides[a.id] } : a)), [data.alerts, overrides]);
  const setAlertStatus = useCallback((id, status) => setOverrides((o) => ({ ...o, [id]: status })), []);
  const markSeen = useCallback(() => setSeen(new Set(alerts.map((a) => a.id))), [alerts]);

  const live = Object.values(sources).some((v) => v === 'live');
  const value = { ...data, alerts, sources, live, updated, loading, refresh: load, setAlertStatus, seen, markSeen };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
