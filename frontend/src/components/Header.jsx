import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Search, Bell, Sun, Moon, ChevronDown, UserRound, ShieldCheck, Building2, KeyRound, LogOut, RefreshCw, Settings2, Wifi, DatabaseZap, X, ShieldAlert, Monitor, Users, BriefcaseBusiness, FileSearch } from 'lucide-react';
import { useDismiss } from '../hooks/useDom';
import { timeAgo } from '../hooks/utils';
import { Avatar, SeverityBadge } from './ui';

export const ANALYST = { name: 'Million Birhanu', role: 'Security Analyst', dept: 'Security Operations', email: 'million.birhanu@corp.local' };

export default function Header({ page, query, setQuery, onMenu, alerts, incidents = [], users = [], hosts = [], rules = [], seen, markSeen, markAlertSeen, notificationsOn, go, theme, toggleTheme, live, demoMode = false, updated, loading, refresh, onProfile, onPin, onSettings, onLogout }) {
  const [notif, setNotif] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const closeN = useCallback(() => setNotif(false), []);
  const closeM = useCallback(() => setMenu(false), []);
  const nRef = useDismiss(notif, closeN);
  const mRef = useDismiss(menu, closeM);
  const input = useRef(null);
  const [activeResult, setActiveResult] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [toastAlert, setToastAlert] = useState(null);
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [
      ...alerts.filter((x) => `${x.id} ${x.title} ${x.user} ${x.host} ${x.ip} ${x.eventId}`.toLowerCase().includes(q)).slice(0, 5).map((item) => ({ type: 'alert', label: item.title, detail: `${item.severity} · ${item.id} · ${item.user}`, route: 'Alerts', item, Icon: ShieldAlert })),
      ...incidents.filter((x) => `${x.id} ${x.title} ${(x.users || []).join(' ')} ${(x.hosts || []).join(' ')}`.toLowerCase().includes(q)).slice(0, 3).map((item) => ({ type: 'incident', label: item.title, detail: `Incident · ${item.id}`, route: 'Incidents', item, Icon: BriefcaseBusiness })),
      ...users.filter((x) => `${x.username} ${x.display} ${x.dept}`.toLowerCase().includes(q)).slice(0, 3).map((item) => ({ type: 'user', label: item.username, detail: `User · risk ${item.risk}`, route: 'User Behavior', item, Icon: Users })),
      ...hosts.filter((x) => `${x.hostname} ${x.ip} ${x.os}`.toLowerCase().includes(q)).slice(0, 3).map((item) => ({ type: 'host', label: item.hostname, detail: `Host · ${item.ip}`, route: 'Hosts', item, Icon: Monitor })),
      ...rules.filter((x) => `${x.id} ${x.name} ${x.eventId} ${x.mitre}`.toLowerCase().includes(q)).slice(0, 3).map((item) => ({ type: 'rule', label: item.name, detail: `Rule · Event ${item.eventId}`, route: 'Detection Rules', item, Icon: FileSearch })),
    ].slice(0, 10);
  }, [query, alerts, incidents, users, hosts, rules]);

  const chooseResult = (result) => { if (!result) return; go(result.route); setQuery(''); setSearchFocused(false); input.current?.blur(); }; 

  useEffect(() => {
    const onKey = (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); setSearch(true); input.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!searchFocused) return undefined;
    const onPointerDown = (e) => { if (!e.target.closest('.search')) setSearchFocused(false); };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [searchFocused]);

  const recent = [...alerts].filter((a) => a.status === 'New' && !seen.has(String(a.id))).sort((a, b) => {
    const ta = Date.parse(a.ts || '') || 0; const tb = Date.parse(b.ts || '') || 0; return tb - ta;
  }).slice(0, 8);
  const submitSearch = (e) => {
    e.preventDefault();
    if (activeResult >= 0 && searchResults.length) chooseResult(searchResults[Math.min(activeResult, searchResults.length - 1)]);
    else { setQuery(input.current?.value ?? query); setSearchFocused(false); }
  };
  const clearSearch = () => {
    setQuery('');
    input.current?.focus();
  };
  const unseen = notificationsOn ? alerts.filter((a) => a.status === 'New' && !seen.has(String(a.id))).length : 0;
  const openAlertFromNotification = (alert) => {
    if (!alert) return;
    markAlertSeen?.(alert.id);
    setNotif(false);
    setQuery('');
    try { localStorage.setItem('cyberdna-pending-alert', String(alert.id)); } catch { /* Continue with navigation if storage is unavailable. */ }
    if (page === 'Alerts') {
      try { localStorage.removeItem('cyberdna-pending-alert'); } catch { /* Ignore storage restrictions. */ }
      window.dispatchEvent(new CustomEvent('cyberdna:open-alert', { detail: { id: String(alert.id) } }));
    } else go('Alerts');
  };

  useEffect(() => {
    if (!notificationsOn) setToastAlert(null);
  }, [notificationsOn]);

  useEffect(() => {
    if (!alerts.length) return;
    const key = 'cyberdna-known-alert-ids-v1';
    let stored = null;
    try { stored = localStorage.getItem(key); } catch { /* Continue with in-memory behavior. */ }
    const currentIds = alerts.map((a) => String(a.id));
    if (stored == null) {
      try { localStorage.setItem(key, JSON.stringify(currentIds.slice(-2000))); } catch { /* Browser storage may be disabled. */ }
      return; // Establish a baseline; do not call all existing records newly arrived.
    }
    let previous = [];
    try { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) previous = parsed.map(String); } catch { previous = []; }
    const known = new Set(previous);
    const fresh = alerts.filter((a) => !known.has(String(a.id)) && a.status === 'New' && !seen.has(String(a.id)))
      .sort((a, b) => (Date.parse(b.ts || '') || 0) - (Date.parse(a.ts || '') || 0));
    if (fresh.length && notificationsOn) setToastAlert(fresh[0]);
    const merged = [...new Set([...previous, ...currentIds])].slice(-2000);
    try { localStorage.setItem(key, JSON.stringify(merged)); } catch { /* Browser storage may be disabled. */ }
  }, [alerts, notificationsOn, seen]);

  return (
    <header className="topbar">
      {toastAlert && notificationsOn && <div className="alert-toast" role="status" aria-live="polite">
        <button type="button" className="alert-toast-main" onClick={() => { const item = toastAlert; setToastAlert(null); openAlertFromNotification(item); }} aria-label={`Open new alert ${toastAlert.title}, ${toastAlert.id}`}>
          <span className="alert-toast-icon"><ShieldAlert size={18} /></span>
          <span className="alert-toast-copy"><small>NEW SECURITY ALERT</small><b>{toastAlert.title}</b><span>{toastAlert.severity} · {toastAlert.user} · {toastAlert.host}</span><small>{timeAgo(toastAlert.ts)} · Click to investigate</small></span>
        </button>
        <button type="button" className="alert-toast-close" onClick={() => setToastAlert(null)} aria-label="Dismiss new alert notification"><X size={16} /></button>
      </div>}
      <button type="button" className="icon-btn hamb" onClick={onMenu} aria-label="Open menu" aria-controls="sidebar"><Menu size={19} /></button>
      <div className="crumb"><small>Cyber DNA</small><b>{page}</b></div>
      <form className={`search ${search ? 'open' : ''}`} role="search" onSubmit={submitSearch} onKeyDown={(e) => { if (e.key === 'ArrowDown' && searchResults.length) { e.preventDefault(); setActiveResult((v) => v < 0 ? 0 : Math.min(searchResults.length - 1, v + 1)); } if (e.key === 'ArrowUp' && searchResults.length) { e.preventDefault(); setActiveResult((v) => v <= 0 ? -1 : v - 1); } if (e.key === 'Escape') { setSearchFocused(false); } }}>
        <button type="submit" className="search-submit" aria-label="Apply search"><Search size={17} aria-hidden="true" /></button>
        <input ref={input} type="search" value={query} onFocus={() => setSearchFocused(true)} onChange={(e) => { setQuery(e.target.value); setActiveResult(-1); setSearchFocused(true); }} placeholder="Search loaded alerts, users, hosts…" aria-label="Search loaded dashboard data" aria-autocomplete="list" aria-expanded={searchFocused && searchResults.length > 0} aria-controls="header-search-results" />
        {query ? (
          <button type="button" className="search-clear" onClick={clearSearch} aria-label="Clear search"><X size={15} /></button>
        ) : (
          <kbd aria-hidden="true">/</kbd>
        )}
      {searchFocused && query.trim() && <div className="header-search-results" id="header-search-results" role="listbox" aria-label="Matching loaded dashboard data">{searchResults.length ? searchResults.map((r, i) => <button type="button" role="option" aria-selected={activeResult === i} key={`${r.type}-${r.label}-${i}`} onMouseEnter={() => setActiveResult(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => chooseResult(r)}><r.Icon size={15} /><span><b>{r.label}</b><small>{r.detail}</small></span></button>) : <div className="header-search-empty">No matches in currently loaded dashboard data.</div>}<small className="header-search-note">Search covers loaded records, not the entire database.</small></div>}
      </form>
      <div className="top-actions">
        <button type="button" className="icon-btn search-toggle" onClick={() => { setSearch(!search); setTimeout(() => input.current?.focus(), 30); }} aria-label="Toggle search"><Search size={18} /></button>
        <button type="button" className={`live-pill ${live ? '' : 'demo'}`} onClick={refresh} title={`${live ? 'Live backend data' : demoMode ? 'Explicit demo data' : 'Backend unavailable'} · last updated ${updated.toLocaleTimeString()} — click to refresh`}>
          {loading ? <RefreshCw size={13} className="spin" /> : live ? <Wifi size={13} /> : <DatabaseZap size={13} />}
          <span>{live ? 'Live' : demoMode ? 'Demo data' : 'Offline'}<span className="txt-long"> · {updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
        </button>
        <button
  type="button"
  className="icon-btn"
  onClick={toggleTheme}
  aria-label="Change theme"
  title={`Current: ${theme}`}
>
  {theme === 'light' ? <Moon size={18} /> : theme === 'dark' ? <Sun size={18} /> : <span style={{ fontSize: 16 }}>🔥</span>}
</button>
        <div className="pop-wrap" ref={nRef}>
          <button type="button" className="icon-btn" onClick={() => { setNotif(!notif); setMenu(false); }} aria-label={`Notifications${unseen ? `, ${unseen} unseen` : ''}`} aria-expanded={notif}>
            <Bell size={18} />{unseen > 0 && <span className="bell-count">{unseen}</span>}
          </button>
          {notif && (
            <div className="popover" role="dialog" aria-label="Notifications">
              <div className="pop-head"><div className="notif-title"><b>Notifications</b><small>{unseen ? `${unseen} new to review` : 'No new notifications'}</small></div>{notificationsOn && unseen > 0 && <button type="button" className="link-btn" onClick={markSeen}>Mark all seen</button>}</div>
              {!notificationsOn ? <div className="empty"><Bell size={24} /><b>Notifications are off</b><span>Turn them on in Settings → Notifications.</span></div>
                : recent.length === 0 ? <div className="empty"><b>You’re all caught up</b><span>Seen alerts stay in the Alerts page, but won’t return to this notification list.</span></div>
                : <>{recent.map((a) => { const isUnseen = a.status === 'New' && !seen.has(String(a.id)); return (
                  <button type="button" key={a.id} className={`notif-item ${isUnseen ? 'unseen' : ''}`} onClick={() => openAlertFromNotification(a)} aria-label={`Open alert ${a.title}, ${a.id}${isUnseen ? ', new' : ', seen'}`}>
                    <SeverityBadge level={a.severity} />
                    <span className="notif-copy"><b>{a.title}</b><small>{a.host} · {a.user} · {timeAgo(a.ts)}</small><small className="notif-state">{isUnseen ? 'New · click to review' : 'Seen'} · Alert {a.id}</small></span>
                    {isUnseen ? <span className="notif-dot" aria-label="Unread" /> : null}
                  </button>
                ); })}</>}
              <div className="pop-foot"><button type="button" className="link-btn" onClick={() => { setNotif(false); go('Alerts'); }}>View all alerts</button></div>
            </div>
          )}
        </div>
        <div className="pop-wrap" ref={mRef}>
          <button type="button" className="profile-btn" onClick={() => { setMenu(!menu); setNotif(false); }} aria-expanded={menu} aria-haspopup="menu" aria-label="Analyst menu">
            <Avatar name={ANALYST.name} variant="profile" />
            <span className="who"><b>{ANALYST.name}</b><small>{ANALYST.role}</small></span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {menu && (
            <div className="popover profile-pop" role="menu">
              <div className="profile-top"><Avatar name={ANALYST.name} size="lg" variant="profile" /><div><b>{ANALYST.name}</b><small>{ANALYST.role}</small></div></div>
              <div className="menu-list">
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); onProfile(); }}><UserRound size={17} />My Profile</button>
                <div className="menu-item static"><ShieldCheck size={17} />Role<span className="val">{ANALYST.role}</span></div>
                <div className="menu-item static"><Building2 size={17} />Department<span className="val">{ANALYST.dept}</span></div>
                <div className="menu-sep" />
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); onSettings(); }}><Settings2 size={17} />Settings</button>
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenu(false); onPin(); }}><KeyRound size={17} />Change PIN</button>
                <div className="menu-sep" />
                <button type="button" role="menuitem" className="menu-item danger" onClick={() => { setMenu(false); onLogout(); }}><LogOut size={17} />Sign out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
