import React from 'react';
import { Server, Radio, CloudCog, Database, ShieldCheck, GitMerge, BrainCircuit } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead } from '../components/ui';
import { ENDPOINTS, API_BASE } from '../api/client';
import { fmtNum, timeAgo } from '../hooks/utils';

const SERVICE_DEFS = [
  { key: 'collector', name: 'Collector', icon: Radio, detail: (d) => d.collector?.last_event ? `Last event ${timeAgo(d.collector.last_event)}` : 'No recent ingested events' },
  { key: 'api', name: 'API', icon: CloudCog, detail: () => `${API_BASE} · API health endpoint` },
  { key: 'database', name: 'Database', icon: Database, detail: (d) => `${fmtNum(d.overview?.totalEvents || 0)} stored events` },
  { key: 'detection', name: 'Detection engine', icon: ShieldCheck, detail: (d) => `${d.detection?.rules_loaded ?? 0} enabled rules · starter rules only` },
  { key: 'correlation', name: 'Correlation engine', icon: GitMerge, detail: () => 'Not implemented' },
  { key: 'ml', name: 'ML engine', icon: BrainCircuit, detail: () => 'Not integrated — no trained model connected' },
];
const labelFor = (key, data) => {
  if (key === 'ml') return 'Not integrated';
  if (key === 'correlation') return data.correlation?.status === 'not_integrated' ? 'Not integrated' : (data.correlation?.status || 'Unknown');
  if (key === 'detection') return data.detection?.status === 'available' ? 'Available' : (data.detection?.status || 'Unknown');
  if (key === 'collector') return data.collector?.status || 'Unknown';
  if (key === 'database') return data.health?.database || 'Unknown';
  return data.health?.status === 'ok' ? 'Online' : 'Offline';
};
const stateClass = (state) => ['online', 'ok', 'available'].includes(String(state).toLowerCase()) ? 'sev-ok' : 'sev-info';

export default function Architecture() {
  const data = useData();
  const { sources, health, collector, detection, correlation, overview, refresh, loading } = data;
  const rows = Object.entries(ENDPOINTS).filter(([k]) => !['health', 'collectorStatus'].includes(k)).map(([k, path]) => ({ key: k, path: `${API_BASE}${path}`, src: sources[k] || 'offline' }));
  return <>
    <PageHead title="Architecture" desc="Live status is based on backend responses and stored events. Unimplemented services are shown honestly." actions={<button className="btn btn-secondary" onClick={refresh} disabled={loading}>{loading ? 'Checking…' : 'Refresh status'}</button>} />
    <Panel title="Pipeline" subtitle={health?.status === 'ok' ? 'Backend API responded successfully' : 'Backend health has not been confirmed'}>
      <div className="flow" style={{ padding: 0 }}>
        <div className="node"><div className="node-top"><span className="node-ico"><Server size={17} /></span><b>Domain controllers</b><span className="badge state sev-info"><i />Awaiting collector data</span></div><small>Windows Security event logs are not assumed connected until events arrive.</small></div>
        {SERVICE_DEFS.map((s) => { const Icon = s.icon; const status = labelFor(s.key, data); return <div className="node" key={s.key}>
          <div className="node-top"><span className="node-ico"><Icon size={17} /></span><b>{s.name}</b><span className={`badge state ${stateClass(status)}`}><i />{status}</span></div>
          <small>{s.detail(data)}</small>
        </div>; })}
      </div>
    </Panel>
    <div className="grid">
      <Panel className="col-6" title="Detection engine"><dl className="kv-list">
        <div><dt>State</dt><dd>{detection?.status || 'Unknown'}</dd></div>
        <div><dt>Method</dt><dd>{detection?.engine || 'Rule-based starter checks'}</dd></div>
        <div><dt>Rules loaded</dt><dd>{detection?.rules_loaded ?? 0}</dd></div>
        <div><dt>Events available</dt><dd>{fmtNum(detection?.events_available ?? 0)}</dd></div>
        <div><dt>Alerts in database</dt><dd>{fmtNum(detection?.alerts_total ?? 0)}</dd></div>
        <div><dt>ML status</dt><dd>Not integrated</dd></div>
      </dl><p className="muted">Starter rules currently check repeated failed logons and audit-log clearing. This is not ML-based detection.</p></Panel>
      <Panel className="col-6" title="Correlation engine"><dl className="kv-list">
        <div><dt>State</dt><dd>{correlation?.status || 'Unknown'}</dd></div>
        <div><dt>Details</dt><dd>{correlation?.message || 'No correlation service connected'}</dd></div>
        <div><dt>Open cases</dt><dd>{overview?.open_incidents ?? 0}</dd></div>
        <div><dt>Last run</dt><dd>Not available</dd></div>
      </dl><p className="muted">Incident correlation is not implemented yet. The API will not claim that incidents were created.</p></Panel>
      <Panel className="col-12" title="API endpoint checks" subtitle="A reachable endpoint does not prove every feature is implemented.">
        <div className="table-wrap"><table><thead><tr><th>Resource</th><th>Path</th><th>Check</th></tr></thead><tbody>{rows.map((r) => <tr key={r.key}><td>{r.key}</td><td className="mono">{r.path}</td><td><span className={`badge ${r.src === 'live' ? 'sev-ok' : 'sev-info'}`}><i />{r.src === 'live' ? 'Responded' : r.src === 'demo' ? 'Demo data' : 'Not confirmed'}</span></td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  </>;
}
