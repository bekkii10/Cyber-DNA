import React, { useState } from 'react';
import { ChevronDown, Check, Eye, Search, BellOff, Download } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, Segmented, SeverityBadge, StatusBadge, Empty } from '../components/ui';
import { StackBar } from '../components/charts';
import { SEVERITIES, cap, fmtTime, timeAgo } from '../hooks/utils';
import { matches } from './shared';

export default function Alerts({ query }) {
  const { alerts, setAlertStatus } = useData();
  const [sev, setSev] = useState('all');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState(null);
  const base = alerts.filter((a) => matches(query, a.title, a.user, a.ip, a.host, a.eventId, a.id));
  const list = base.filter((a) => (sev === 'all' || a.severity === sev) && (status === 'all' || a.status === status));
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
          <article key={a.id} className={`alert-card bar-${a.severity} ${a.severity === 'critical' && a.status !== 'Resolved' ? 'is-critical' : ''}`}>
            <div className="alert-top">
              <SeverityBadge level={a.severity} />
              <button type="button" className="ttl" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>{a.title}</button>
              <StatusBadge status={a.status} />
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
                <div className="alert-actions">
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
