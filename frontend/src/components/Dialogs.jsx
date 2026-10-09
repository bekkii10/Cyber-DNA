import React, { useState } from 'react';
import { Palette, LayoutDashboard, Bell, LockKeyhole } from 'lucide-react';
import { Modal, Toggle, Avatar } from './ui';
import { ANALYST } from './Header';

const PIN_KEY = 'cyberdna-pin';
export const getPin = () => { try { return localStorage.getItem(PIN_KEY) || '1234'; } catch { return '1234'; } };

const Section = ({ icon: Icon, title, children }) => <section className="set-section"><div className="set-title"><Icon size={17} aria-hidden="true" />{title}</div>{children}</section>;
const Row = ({ id, title, desc, children }) => <div className="set-row"><div><label htmlFor={id} className="lbl">{title}</label><small>{desc}</small></div>{children}</div>;

export function SettingsDialog({ settings, update, onClose, onPin, status }) {
  return (
    <Modal title="Settings" desc="Changes apply immediately and are saved on this device." onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
      <Section icon={Palette} title="Appearance">
        <Row id="s-theme" title="Theme" desc="Choose your interface color.">
  <select id="s-theme" value={settings.theme} onChange={(e) => update('theme', e.target.value)}>
    <option value="light">☀️ Light</option>
    <option value="dark">🌙 Dark</option>
    <option value="Red">🔥 Cyber DNA</option>
  </select>
</Row>
        <Row id="s-font" title="Font size" desc="Scales all text across the dashboard."><select id="s-font" value={settings.font} onChange={(e) => update('font', e.target.value)}><option value="normal">Normal</option><option value="large">Large</option></select></Row>
        <Row id="s-motion" title="Reduce animations" desc="Turns off transitions and motion."><Toggle on={settings.reduce} onChange={(v) => update('reduce', v)} label="Reduce animations" /></Row>
      </Section>
      <Section icon={LayoutDashboard} title="Dashboard">
        <Row id="s-range" title="Default time range" desc="Period shown in Event Activity."><select id="s-range" value={settings.range} onChange={(e) => update('range', e.target.value)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></Row>
        <Row id="s-refresh" title="Auto refresh" desc="Reload data every 30 seconds."><Toggle on={settings.refresh} onChange={(v) => update('refresh', v)} label="Auto refresh" /></Row>
      </Section>
      <Section icon={Bell} title="Notifications">
        <Row id="s-alerts" title="Alert notifications" desc="Show new alerts in the bell menu and badge."><Toggle on={settings.alerts} onChange={(v) => update('alerts', v)} label="Alert notifications" /></Row>
        <Row id="s-high" title="High-risk alerts" desc="Show a critical-alert banner on the Overview."><Toggle on={settings.highRisk} onChange={(v) => update('highRisk', v)} label="High-risk alerts" /></Row>
      </Section>
      <Section icon={LockKeyhole} title="Security">
        <Row id="s-timeout" title="Session timeout" desc="Sign out after inactivity."><select id="s-timeout" value={settings.timeout} onChange={(e) => update('timeout', e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></Row>
        <Row id="s-pin" title="Dashboard PIN" desc="Four digits used for analyst access."><button id="s-pin" className="btn btn-secondary btn-sm" onClick={onPin}>Change PIN</button></Row>
      </Section>
      <section className="set-section">
        <div className="set-title">About</div>
        <div className="set-row"><span>Cyber DNA version</span><b>1.1.0</b></div>
        <div className="set-row"><span>System status</span><b className={`badge ${status.all ? 'sev-ok' : 'sev-info'}`}><i />{status.all ? 'All services online' : 'Demo mode — backend not connected'}</b></div>
      </section>
    </Modal>
  );
}

export function PinDialog({ onClose }) {
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [conf, setConf] = useState('');
  const [msg, setMsg] = useState(null);
  const digits = (set) => (e) => set(e.target.value.replace(/\D/g, '').slice(0, 4));
  const save = (e) => {
    e.preventDefault();
    if (cur !== getPin()) return setMsg({ t: 'err', m: 'Current PIN is incorrect.' });
    if (next.length !== 4) return setMsg({ t: 'err', m: 'New PIN must be exactly 4 digits.' });
    if (next !== conf) return setMsg({ t: 'err', m: 'New PIN and confirmation do not match.' });
    try { localStorage.setItem(PIN_KEY, next); } catch { /* ignore */ }
    setMsg({ t: 'ok', m: 'PIN updated successfully.' }); setCur(''); setNext(''); setConf('');
  };
  return (
    <Modal small title="Change PIN" desc="Demo PIN is 1234 until you change it. In production this calls the backend." onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button><button form="pin-form" className="btn btn-primary">Save PIN</button></>}>
      <form id="pin-form" onSubmit={save}>
        <label className="field-label">Current PIN<input type="password" inputMode="numeric" autoComplete="off" value={cur} onChange={digits(setCur)} placeholder="••••" /></label>
        <label className="field-label">New PIN<input type="password" inputMode="numeric" autoComplete="off" value={next} onChange={digits(setNext)} placeholder="4 digits" /></label>
        <label className="field-label">Confirm new PIN<input type="password" inputMode="numeric" autoComplete="off" value={conf} onChange={digits(setConf)} placeholder="Repeat PIN" /></label>
        {msg && <div className={`form-note ${msg.t}`} role="status">{msg.m}</div>}
      </form>
    </Modal>
  );
}

export function ProfileDialog({ onClose, onPin, timeout }) {
  return (
    <Modal small title="My Profile" desc="Signed-in analyst — not a monitored AD user." onClose={onClose} footer={<><button className="btn btn-secondary" onClick={onPin}>Change PIN</button><button className="btn btn-primary" onClick={onClose}>Close</button></>}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '.5rem 0 1rem' }}>
        <Avatar name={ANALYST.name} size="lg" /><div><b style={{ fontSize: '1.0625rem' }}>{ANALYST.name}</b><div className="muted">{ANALYST.role}</div></div>
      </div>
      <dl className="kv-list">
        <div><dt>Role</dt><dd>{ANALYST.role}</dd></div>
        <div><dt>Department</dt><dd>{ANALYST.dept}</dd></div>
        <div><dt>Email</dt><dd>{ANALYST.email}</dd></div>
        <div><dt>Access level</dt><dd>Read / triage</dd></div>
        <div><dt>Session timeout</dt><dd>{timeout} minutes</dd></div>
      </dl>
    </Modal>
  );
}
