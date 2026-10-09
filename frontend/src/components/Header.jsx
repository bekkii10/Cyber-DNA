import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Search, Bell, Sun, Moon, ChevronDown, UserRound, ShieldCheck, Building2, KeyRound, LogOut, RefreshCw, Settings2, Wifi, DatabaseZap } from 'lucide-react';
import { useDismiss } from '../hooks/useDom';
import { timeAgo } from '../hooks/utils';
import { Avatar, SeverityBadge } from './ui';

export const ANALYST = { name: 'Million Birhanu', role: 'Security Analyst', dept: 'Security Operations', email: 'million.birhanu@corp.local' };

export default function Header({ page, query, setQuery, onMenu, alerts, seen, markSeen, notificationsOn, go, theme, toggleTheme, live, updated, loading, refresh, onProfile, onPin, onSettings, onLogout }) {
  const [notif, setNotif] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const closeN = useCallback(() => setNotif(false), []);
  const closeM = useCallback(() => setMenu(false), []);
  const nRef = useDismiss(notif, closeN);
  const mRef = useDismiss(menu, closeM);
  const input = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); setSearch(true); input.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const recent = alerts.filter((a) => a.status !== 'Resolved').slice(0, 5);
  const unseen = notificationsOn ? alerts.filter((a) => a.status === 'New' && !seen.has(a.id)).length : 0;

  return (
    <header className="topbar">
      <button type="button" className="icon-btn hamb" onClick={onMenu} aria-label="Open menu" aria-controls="sidebar"><Menu size={19} /></button>
      <div className="crumb"><small>Cyber DNA</small><b>{page}</b></div>
      <div className={`search ${search ? 'open' : ''}`} role="search">
        <Search size={17} aria-hidden="true" />
        <input ref={input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users, hosts, IPs, alerts…" aria-label="Search" />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <div className="top-actions">
        <button type="button" className="icon-btn search-toggle" onClick={() => { setSearch(!search); setTimeout(() => input.current?.focus(), 30); }} aria-label="Toggle search"><Search size={18} /></button>
        <button type="button" className={`live-pill ${live ? '' : 'demo'}`} onClick={refresh} title={`Last updated ${updated.toLocaleTimeString()} — click to refresh`}>
          {loading ? <RefreshCw size={13} className="spin" /> : live ? <Wifi size={13} /> : <DatabaseZap size={13} />}
          <span>{live ? 'Live' : 'Demo data'}<span className="txt-long"> · {updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></span>
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
              <div className="pop-head"><b>Notifications</b>{notificationsOn && <button type="button" className="link-btn" onClick={markSeen}>Mark all seen</button>}</div>
              {!notificationsOn ? <div className="empty"><Bell size={24} /><b>Notifications are off</b><span>Turn them on in Settings → Notifications.</span></div>
                : recent.length === 0 ? <div className="empty"><b>You’re all caught up</b></div>
                : recent.map((a) => (
                  <button type="button" key={a.id} className={`notif-item ${!seen.has(a.id) && a.status === 'New' ? 'unseen' : ''}`} onClick={() => { setNotif(false); go('Alerts'); }}>
                    <SeverityBadge level={a.severity} />
                    <span><b>{a.title}</b><small>{a.host} · {timeAgo(a.ts)}</small></span>
                  </button>
                ))}
              <div className="pop-foot"><button type="button" className="link-btn" onClick={() => { setNotif(false); go('Alerts'); }}>View all alerts</button></div>
            </div>
          )}
        </div>
        <div className="pop-wrap" ref={mRef}>
          <button type="button" className="profile-btn" onClick={() => { setMenu(!menu); setNotif(false); }} aria-expanded={menu} aria-haspopup="menu" aria-label="Analyst menu">
            <Avatar name={ANALYST.name} />
            <span className="who"><b>{ANALYST.name}</b><small>{ANALYST.role}</small></span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {menu && (
            <div className="popover profile-pop" role="menu">
              <div className="profile-top"><Avatar name={ANALYST.name} size="lg" /><div><b>{ANALYST.name}</b><small>{ANALYST.role}</small></div></div>
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
