import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DataProvider, useData } from './data/DataContext';
import { useSettings } from './hooks/useSettings';
import Login, { Splash } from './components/Login';
import Sidebar, { NAV } from './components/Sidebar';
import Header from './components/Header';
import { SettingsDialog, PinDialog, ProfileDialog } from './components/Dialogs';
import Overview from './pages/Overview';
import Alerts from './pages/Alerts';
import Incidents from './pages/Incidents';
import UserBehavior from './pages/UserBehavior';
import Hosts from './pages/Hosts';
import Rules from './pages/Rules';
import RiskML from './pages/RiskML';
import Architecture from './pages/Architecture';

const PAGES = NAV.flatMap((g) => g.items.map(([n]) => n));
const slug = (p) => p.toLowerCase().replace(/[^a-z]+/g, '-');
const fromHash = () => PAGES.find((p) => `#/${slug(p)}` === window.location.hash) || 'Overview';
const SESSION = 'cyberdna-session';
const THEME_CYCLE = ['light', 'dark', 'cyberdna'];

function Shell({ settings, update, onLogout }) {
  const { alerts, seen, markSeen, live, updated, loading, refresh } = useData();
  const [page, setPage] = useState(fromHash);
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState(null); // settings | pin | profile
  const [query, setQuery] = useState('');
  const scroller = useRef(null);

  useEffect(() => {
    const on = () => setPage(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = useCallback((p) => {
    window.location.hash = `/${slug(p)}`;
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    if (!drawer) return undefined;
    const k = (e) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [drawer]);

  const status = {
    collector: live ? 'online' : 'demo',
    api: live ? 'online' : 'demo',
    database: live ? 'online' : 'demo',
  };

  const newAlerts = settings.alerts ? alerts.filter((a) => a.status === 'New').length : 0;

  const toggleTheme = () => {
    const idx = THEME_CYCLE.indexOf(settings.theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    update('theme', next);
  };

  const closeDialog = useCallback(() => setDialog(null), []);

  const props = { query };
  const view = {
    Overview: <Overview range={settings.range} setRange={(v) => update('range', v)} />,
    Alerts: <Alerts {...props} />,
    Incidents: <Incidents {...props} />,
    'User Behavior': <UserBehavior {...props} />,
    Hosts: <Hosts {...props} />,
    'Detection Rules': <Rules {...props} />,
    'Risk & ML': <RiskML {...props} />,
    Architecture: <Architecture />,
  }[page];

  return (
    <div className="shell">
      <Sidebar
        page={page}
        go={go}
        open={drawer}
        close={() => setDrawer(false)}
        openSettings={() => setDialog('settings')}
        alertCount={newAlerts}
        status={status}
      />
      {drawer && <button type="button" className="shade" aria-label="Close menu" onClick={() => setDrawer(false)} />}
      <div className="main">
        <Header
          page={page}
          query={query}
          setQuery={setQuery}
          onMenu={() => setDrawer(true)}
          alerts={alerts}
          seen={seen}
          markSeen={markSeen}
          notificationsOn={settings.alerts}
          go={go}
          theme={settings.theme}
          toggleTheme={toggleTheme}
          live={live}
          updated={updated}
          loading={loading}
          refresh={refresh}
          onProfile={() => setDialog('profile')}
          onPin={() => setDialog('pin')}
          onSettings={() => setDialog('settings')}
          onLogout={onLogout}
        />
        <main className="content" ref={scroller} id="main">{view}</main>
      </div>
      {dialog === 'settings' && (
        <SettingsDialog settings={settings} update={update} onClose={closeDialog} onPin={() => setDialog('pin')} status={{ all: live }} />
      )}
      {dialog === 'pin' && <PinDialog onClose={closeDialog} />}
      {dialog === 'profile' && <ProfileDialog onClose={closeDialog} onPin={() => setDialog('pin')} timeout={settings.timeout} />}
    </div>
  );
}

export default function App() {
  const [settings, update] = useSettings();
  const [splash, setSplash] = useState(() => {
    try { return !sessionStorage.getItem('cyberdna-splash'); } catch { return true; }
  });
  const [logged, setLogged] = useState(() => {
    try { return sessionStorage.getItem(SESSION) === '1'; } catch { return false; }
  });
  const [notice, setNotice] = useState('');

  // === THIS IS THE IMPORTANT PART ===
  // Apply the selected theme to <html data-theme="...">
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const login = () => {
    try { sessionStorage.setItem(SESSION, '1'); } catch { /* ignore */ }
    setLogged(true);
  };

  const logout = useCallback((msg = '') => {
    try { sessionStorage.removeItem(SESSION); } catch { /* ignore */ }
    setLogged(false);
    setNotice(msg);
  }, []);

  const endSplash = useCallback(() => {
    try { sessionStorage.setItem('cyberdna-splash', '1'); } catch { /* ignore */ }
    setSplash(false);
  }, []);

  // Session timeout: sign out after the configured period without activity
  useEffect(() => {
    if (!logged) return undefined;
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout('You were signed out due to inactivity.'), settings.timeout * 60 * 1000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [logged, settings.timeout, logout]);

  if (splash) return <Splash onDone={endSplash} reduced={settings.reduce} />;
  if (!logged) return <Login onLogin={login} theme={settings.theme} toggleTheme={() => {
    const idx = THEME_CYCLE.indexOf(settings.theme);
    update('theme', THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  }} notice={notice} />;

  return (
    <DataProvider range={settings.range} autoRefresh={settings.refresh}>
      <Shell settings={settings} update={update} onLogout={logout} />
    </DataProvider>
  );
}
