import { useCallback, useEffect, useState } from 'react';

const KEY = 'cyberdna-settings';
const prefersReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const DEFAULTS = { theme: 'light', font: 'normal', reduce: false, range: '24h', refresh: true, alerts: true, highRisk: true, timeout: '30' };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    return { ...DEFAULTS, reduce: prefersReduced(), ...(saved || {}) };
  } catch { return { ...DEFAULTS, reduce: prefersReduced() }; }
}

export function useSettings() {
  const [settings, setSettings] = useState(load);
  useEffect(() => {
    const d = document.documentElement;
    d.dataset.theme = settings.theme;
    d.dataset.font = settings.font;
    d.dataset.motion = settings.reduce ? 'reduced' : 'full';
    d.style.colorScheme = settings.theme === 'light' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }, [settings]);
  const update = useCallback((k, v) => setSettings((s) => ({ ...s, [k]: v })), []);
  return [settings, update];
}
