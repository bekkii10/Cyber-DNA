import React, { useState } from 'react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, Segmented, DataTable, SeverityBadge, Toggle, useSort } from '../components/ui';
import { matches } from './shared';

export default function Rules({ query }) {
  const { rules } = useData();
  const [over, setOver] = useState({});
  const [tab, setTab] = useState('all');
  const withState = rules.map((r) => ({ ...r, enabled: over[r.id] ?? r.enabled }));
  const base = withState.filter((r) => matches(query, r.name, r.eventId, r.mitre, r.id));
  const filtered = base.filter((r) => tab === 'all' || (tab === 'on' ? r.enabled : !r.enabled));
  const { sorted, sort, onSort } = useSort(filtered, { key: 'hits', dir: 'desc' });
  return (
    <>
      <PageHead title="Detection rules" desc="Rules that turn Windows events into alerts. Toggles are local until the rules API supports updates." />
      <Panel flush title="Rule library" subtitle={`${withState.filter((r) => r.enabled).length} of ${withState.length} enabled`} action={<Segmented label="Rule state" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'on', label: 'Enabled' }, { value: 'off', label: 'Disabled' }]} />}>
        <DataTable rows={sorted} rowKey={(r) => r.id} sort={sort} onSort={onSort} columns={[
          { key: 'name', label: 'Rule', sortable: true, primary: true, render: (r) => <><span className="cell-strong">{r.name}</span><span className="cell-sub">{r.id} · {r.description}</span></> },
          { key: 'eventId', label: 'Event ID', render: (r) => <span className="mono">{r.eventId}</span> },
          { key: 'severity', label: 'Severity', render: (r) => <SeverityBadge level={r.severity} /> },
          { key: 'mitre', label: 'MITRE ATT&CK', render: (r) => <span className="badge plain mono">{r.mitre}</span> },
          { key: 'hits', label: 'Hits (24h)', sortable: true, align: 'right', render: (r) => <span className="num">{r.hits}</span> },
          { key: 'enabled', label: 'Enabled', align: 'right', render: (r) => <Toggle on={r.enabled} onChange={(v) => setOver((o) => ({ ...o, [r.id]: v }))} label={`${r.name} enabled`} /> },
        ]} />
      </Panel>
    </>
  );
}
