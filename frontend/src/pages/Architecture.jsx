import React from 'react';
import { Server, ArrowDown } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, DataTable } from '../components/ui';
import { ENDPOINTS, API_BASE } from '../api/client';
import { services } from '../data/mock';
import { fmtNum, timeAgo } from '../hooks/utils';
import { ICONS } from './shared';

export default function Architecture() {
  const { sources, live, detection, correlation, refresh, loading } = useData();
  const rows = Object.entries(ENDPOINTS).map(([k, path]) => ({ key: k, path: `${API_BASE}${path}`, src: sources[k] || 'demo' }));
  return (
    <>
      <PageHead title="Architecture" desc="Data flows from Windows event sources through the collector and API to detection, correlation and ML." />
      <Panel title="Pipeline" subtitle={live ? 'Connected to the Cyber DNA backend' : 'Backend not reachable — showing demo values'}>
        <div className="flow" style={{ padding: 0 }}>
          <div className="node"><div className="node-top"><span className="node-ico"><Server size={17} /></span><b>Domain controllers</b></div><small>Windows Security event logs</small></div>
          {services.map((s) => { const Icon = ICONS[s.icon]; return (
            <div className="node" key={s.key}>
              <div className="node-top"><span className="node-ico"><Icon size={17} /></span><b>{s.name}</b><span className={`badge state ${live ? 'sev-ok' : 'sev-info'}`}><i />{live ? 'Online' : 'Demo'}</span></div>
              <small>{s.detail}</small><small>Uptime {s.uptime}%</small>
            </div>
          ); })}
        </div>
      </Panel>
      <div className="grid">
        <Panel className="col-6" title="Detection engine"><dl className="kv-list">
          <div><dt>State</dt><dd>{detection.state}</dd></div><div><dt>Rules loaded</dt><dd>{detection.rulesLoaded}</dd></div>
          <div><dt>Events processed</dt><dd>{fmtNum(detection.eventsProcessed)}</dd></div><div><dt>Alerts generated</dt><dd>{detection.alertsGenerated}</dd></div>
          <div><dt>Last run</dt><dd>{timeAgo(detection.lastRun)}</dd></div></dl></Panel>
        <Panel className="col-6" title="Correlation engine"><dl className="kv-list">
          <div><dt>State</dt><dd>{correlation.state}</dd></div><div><dt>Window</dt><dd>{correlation.windowMinutes} minutes</dd></div>
          <div><dt>Open cases</dt><dd>{correlation.openCases}</dd></div><div><dt>Correlated events</dt><dd>{fmtNum(correlation.correlatedEvents)}</dd></div>
          <div><dt>Last run</dt><dd>{timeAgo(correlation.lastRun)}</dd></div></dl></Panel>
      </div>
     </>
  );
}
