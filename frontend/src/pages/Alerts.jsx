import React, { useEffect, useState } from 'react';
import { ChevronDown, Check, Eye, Search, BellOff, Download, MoreHorizontal } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, Segmented, SeverityBadge, StatusBadge, Empty } from '../components/ui';
import { StackBar } from '../components/charts';
import { SEVERITIES, cap, fmtTime, timeAgo } from '../hooks/utils';
import { matches } from './shared';
import { useAssistantContext } from '../components/assistant/AssistantProvider';
import { alertContext } from '../components/assistant/contextBuilders';
import { openContextMenu } from '../components/interactions/events';
import AnalystExplanation from '../components/AnalystExplanation';

export default function Alerts({ query }) {
  const { alerts, setAlertStatus, seen, markAlertSeen } = useData();
  const [sev, setSev] = useState('all');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(null);
  const [targetAlert, setTargetAlert] = useState(null);

  useEffect(() => {
    const selectAlert = (id) => {
      if (!id) return;
      const found = alerts.find((a) => String(a.id) === String(id));
      if (!found) return false;
      setSev('all'); setStatus('all'); setOpen(found.id); setTargetAlert(found.id);
      try { localStorage.removeItem('cyberdna-pending-alert'); } catch { /* Ignore storage restrictions. */ }
      return true;
    };
    const pending = (() => { try { return localStorage.getItem('cyberdna-pending-alert'); } catch { return null; } })();
    if (pending) selectAlert(pending);
    const onOpenAlert = (event) => selectAlert(event.detail?.id);
    window.addEventListener('cyberdna:open-alert', onOpenAlert);
    return () => window.removeEventListener('cyberdna:open-alert', onOpenAlert);
  }, [alerts]);

  useEffect(() => {
    if (!targetAlert) return undefined;
    const node = document.getElementById(`alert-card-${targetAlert}`);
    if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); node.focus({ preventScroll: true }); }
    const timer = window.setTimeout(() => setTargetAlert(null), 3200);
    return () => window.clearTimeout(timer);
  }, [targetAlert, open, alerts]);
  const base = alerts.filter((a) => matches(query, a.title, a.user, a.ip, a.host, a.eventId, a.id));
  const list = base.filter((a) => (sev === 'all' || a.severity === sev) && (status === 'all' || a.status === status));
  const openAlert = alerts.find((a) => a.id === open);
  useAssistantContext({ selection: openAlert && alertContext(openAlert), filters: { severity: sev !== 'all' ? sev : undefined, status: status !== 'all' ? status : undefined } });
  const counts = SEVERITIES.map((s) => ({ key: s, label: cap(s), value: base.filter((a) => a.severity === s).length }));

  const exportCsv = () => {
    const head = ['id', 'severity', 'title', 'eventId', 'user', 'ip', 'host', 'timestamp', 'status'];
    const csv = [head, ...list.map((a) => [a.id, a.severity, a.title, a.eventId, a.user, a.ip, a.host, a.ts, a.status])].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'cyber-dna-alerts.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead title="Alerts" desc="Triage detections generated from Windows security events." actions={<button className="btn btn-secondary" onClick={exportCsv}><Download size={16} />Export CSV</button>} />
      <Panel title="Severity distribution" subtitle={`${base.length} alerts${query ? ' matching your search' : ''}`}>
        <div className="summary-strip" style={{ padding: 0 }}>
          <StackBar items={counts} />
          <div className="sev-counts">{counts.map((c) => <button type="button" key={c.key} className={`bar-${c.key}`} onClick={() => setSev(sev === c.key ? 'all' : c.key)} aria-pressed={sev === c.key}><i />{c.label} <b>{c.value}</b></button>)}</div>
        </div>
      </Panel>
      <Panel flush title="Alert queue" action={
        <div className="toolbar">
          <Segmented label="Severity" value={sev} onChange={setSev} options={[{ value: 'all', label: 'All' }, ...SEVERITIES.slice(0, 4).map((s) => ({ value: s, label: cap(s) }))]} />
          <select aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>{['New', 'Investigating', 'Acknowledged', 'Resolved'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>}>
        {list.length === 0 ? <Empty icon={query ? Search : BellOff} title="No alerts match" text="Try clearing filters or the search box." /> : list.map((a) => (
          <article id={`alert-card-${a.id}`} key={a.id} tabIndex={-1} onContextMenu={(e) => openContextMenu(e, 'alert', a)} className={`alert-card bar-${a.severity} ${a.severity === 'critical' && a.status !== 'Resolved' ? 'is-critical' : ''} ${targetAlert === a.id ? 'is-notification-target' : ''}`} aria-label={`Alert ${a.id}: ${a.title}`}>
            <div className="alert-top">
              <SeverityBadge level={a.severity} />
              <button type="button" className="ttl" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>{a.title}</button>
              <StatusBadge status={a.status} />
              <button type="button" className="icon-btn context-more" aria-label={`More actions for ${a.id}`} title="More actions" onClick={(e) => openContextMenu(e, 'alert', a)}><MoreHorizontal size={16} /></button>
              <button type="button" className="icon-btn" style={{ width: '2rem', height: '2rem' }} onClick={() => setOpen(open === a.id ? null : a.id)} aria-label={open === a.id ? 'Collapse details' : 'Expand details'}><ChevronDown size={16} style={{ transform: open === a.id ? 'rotate(180deg)' : 'none' }} /></button>
            </div>
            <dl className="alert-fields">
              <div><dt>Alert ID</dt><dd className="mono">{a.id}</dd></div>
              <div><dt>Event ID</dt><dd>{a.eventId}</dd></div>
              <div><dt>Username</dt><dd>{a.user}</dd></div>
              <div><dt>Source IP</dt><dd className="mono">{a.ip}</dd></div>
              <div><dt>Host</dt><dd>{a.host}</dd></div>
              <div><dt>Time</dt><dd title={fmtTime(a.ts)}>{timeAgo(a.ts)}</dd></div>
            </dl>
            {open === a.id && (
              <div className="alert-detail">
                <p>{a.description || 'No description provided.'}</p>
                <div className="muted">Detection rule: <b style={{ color: 'var(--text)' }}>{a.rule}</b> · {fmtTime(a.ts)}</div>
                <AnalystExplanation context={{ page: 'Alerts', selection: alertContext(a) }} question={`Explain alert ${a.id} in simple terms. Describe what happened, the database-backed evidence, what the detection does and does not prove, risk, and prioritized next steps. Do not call suspicious activity a confirmed attack unless evidence confirms it.`} title={`AI Analyst explanation · ${a.id}`} />
                <div className="alert-actions">
                  {!seen.has(String(a.id)) && <button className="btn btn-secondary btn-sm" onClick={() => markAlertSeen(a.id)}><Eye size={14} />Mark seen</button>}
                  <button className="btn btn-secondary btn-sm" disabled={a.status === 'Acknowledged' || a.status === 'Resolved'} onClick={() => setAlertStatus(a.id, 'Acknowledged')}><Eye size={14} />Acknowledge</button>
                  <button className="btn btn-secondary btn-sm" disabled={a.status === 'Investigating' || a.status === 'Resolved'} onClick={() => setAlertStatus(a.id, 'Investigating')}>Investigate</button>
                  <button className="btn btn-primary btn-sm" disabled={a.status === 'Resolved'} onClick={() => setAlertStatus(a.id, 'Resolved')}><Check size={14} />Resolve</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </Panel>
    </>
  );
}
