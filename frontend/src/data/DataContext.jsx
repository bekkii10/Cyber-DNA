import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPatch, apiPost, ENDPOINTS } from '../api/client';
import { adaptAlert, adaptHost, adaptIncident, adaptRule, adaptUser, asList } from '../api/adapters';
import * as mock from './mock';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const SEEN_KEY = 'cyberdna-alerts-seen-v1';
const readSeen = () => { try { const value = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return new Set(Array.isArray(value) ? value.map(String) : []); } catch { return new Set(); } };
const emptyOverview = { totalEvents: 0, eventsDelta: null, distribution: [] };
const emptyActivity = (range = '24h') => {
  const count = range === '24h' ? 24 : range === '7d' ? 7 : 30;
  const labels = Array.from({ length: count }, (_, i) => range === '24h' ? `${String(i).padStart(2, '0')}:00` : `-${count - i - 1}d`);
  return { labels, series: [{ key: 'events', label: 'Events', values: Array(count).fill(0) }] };
};
const emptyLists = { alerts: [], incidents: [], users: [], hosts: [], rules: [] };
const initialData = (range) => DEMO_MODE ? {
  alerts: mock.alerts, incidents: mock.incidents, users: mock.users, hosts: mock.hosts, rules: mock.rules,
  overview: mock.overview, detection: mock.detection, correlation: mock.correlation, activity: mock.activitySeries(range), health: null, collector: null,
} : { ...emptyLists, overview: emptyOverview, detection: { status: 'not_configured' }, correlation: { status: 'not_integrated' }, activity: emptyActivity(range), health: null, collector: null };

const LISTS = {
  alerts: [ENDPOINTS.alerts, adaptAlert], incidents: [ENDPOINTS.incidents, adaptIncident],
  users: [ENDPOINTS.users, adaptUser], hosts: [ENDPOINTS.hosts, adaptHost], rules: [ENDPOINTS.rules, adaptRule],
};

export function DataProvider({ range, autoRefresh, children }) {
  const [data, setData] = useState(() => initialData(range));
  const [sources, setSources] = useState({});
  const [updated, setUpdated] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [seen, setSeen] = useState(readSeen);
  const saveSeen = useCallback((next) => {
    setSeen(next);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-2000))); } catch { /* Browser storage may be disabled. */ }
  }, []);

  useEffect(() => {
    const syncSeen = (event) => {
      if (event.key === SEEN_KEY) setSeen(readSeen());
    };
    window.addEventListener('storage', syncSeen);
    return () => window.removeEventListener('storage', syncSeen);
  }, []);

  useEffect(() => {
    const serverSeen = data.alerts.filter((alert) => alert.seen === true).map((alert) => String(alert.id));
    if (!serverSeen.length || serverSeen.every((id) => seen.has(id))) return;
    const next = new Set(readSeen());
    serverSeen.forEach((id) => next.add(id));
    saveSeen(next);
  }, [data.alerts, saveSeen, seen]);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const load = useCallback(async () => {
    setLoading(true);
    const next = {}; const src = {};
    const tasks = [
      ...Object.entries(LISTS).map(async ([key, [path, adapt]]) => {
        try { const list = asList(await apiGet(path)); if (!list) throw new Error('Unexpected API response'); next[key] = list.map(adapt); src[key] = 'live'; }
        catch { next[key] = DEMO_MODE ? mock[key] : []; src[key] = DEMO_MODE ? 'demo' : 'offline'; }
      }),
      (async () => {
        try {
          const o = await apiGet(ENDPOINTS.overview);
          next.overview = { totalEvents: Number(o.events_count ?? o.total_events ?? 0), eventsDelta: o.events_delta ?? o.eventsDelta ?? null,
            distribution: Array.isArray(o.distribution) ? o.distribution : [], ...o };
          src.overview = 'live';
        } catch { next.overview = DEMO_MODE ? mock.overview : emptyOverview; src.overview = DEMO_MODE ? 'demo' : 'offline'; }
      })(),
      (async () => {
        try {
          const a = await apiGet(ENDPOINTS.activity, { hours: rangeRef.current === '24h' ? 24 : rangeRef.current === '7d' ? 168 : 720 });
          if (Array.isArray(a.labels) && Array.isArray(a.series)) next.activity = a;
          else if (Array.isArray(a.points)) next.activity = { labels: a.points.map((p) => p.time), series: [{ key: 'events', label: 'Events', values: a.points.map((p) => Number(p.count || 0)) }] };
          else throw new Error('Unexpected activity response');
          src.activity = 'live';
        } catch { next.activity = DEMO_MODE ? mock.activitySeries(rangeRef.current) : emptyActivity(rangeRef.current); src.activity = DEMO_MODE ? 'demo' : 'offline'; }
      })(),
      (async () => { try { next.detection = await apiGet(ENDPOINTS.detection); src.detection = 'live'; } catch { next.detection = DEMO_MODE ? mock.detection : { status: 'offline' }; src.detection = DEMO_MODE ? 'demo' : 'offline'; } })(),
      (async () => { try { next.correlation = await apiGet(ENDPOINTS.correlation); src.correlation = 'live'; } catch { next.correlation = DEMO_MODE ? mock.correlation : { status: 'offline' }; src.correlation = DEMO_MODE ? 'demo' : 'offline'; } })(),
      (async () => { try { next.health = await apiGet(ENDPOINTS.health); src.health = 'live'; } catch { next.health = { status: 'offline', database: 'unknown', collector: 'unknown', ml_engine: 'not_integrated' }; src.health = 'offline'; } })(),
      (async () => { try { next.collector = await apiGet(ENDPOINTS.collectorStatus); src.collector = 'live'; } catch { next.collector = { status: 'offline', events_received: 0 }; src.collector = 'offline'; } })(),
    ];
    await Promise.all(tasks);
    setData((d) => ({ ...d, ...next }));
    setSources(src);
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
  const setAlertStatus = useCallback(async (id, status) => {
    try { await apiPatch(`/alerts/${encodeURIComponent(id)}/status`, { status }); setOverrides((o) => ({ ...o, [id]: status })); await load(); }
    catch { /* Keep the displayed status unchanged when the backend cannot save it. */ }
  }, [load]);
  const markAlertSeen = useCallback(async (id) => {
    if (id == null) return;
    const next = new Set(readSeen());
    next.add(String(id));
    saveSeen(next);
    try {
      await apiPatch(`/alerts/${encodeURIComponent(id)}/seen`, { seen: true });
      await load();
    } catch { /* Local state remains; server state will be retried by explicit refresh. */ }
  }, [saveSeen, load]);

  const markSeen = useCallback(async () => {
    const next = new Set(readSeen());
    alerts.forEach((a) => next.add(String(a.id)));
    saveSeen(next);
    try { await apiPost('/alerts/mark-all-seen', {}); await load(); } catch { /* Local notification state remains saved; backend status is unchanged if unavailable. */ }
  }, [alerts, load, saveSeen]);
  const live = sources.health === 'live' && data.health?.status === 'ok';
  const value = { ...data, alerts, sources, live, updated, loading, refresh: load, setAlertStatus, seen, markSeen, markAlertSeen, demoMode: DEMO_MODE };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
