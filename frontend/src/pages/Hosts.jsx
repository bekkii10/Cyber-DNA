import React, { useState } from 'react';
import { MonitorX } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, Segmented, DataTable, StatusBadge, Risk, Empty, useSort } from '../components/ui';
import { fmtNum, timeAgo } from '../hooks/utils';
import { matches } from './shared';

export default function Hosts({ query }) {
  const { hosts } = useData();
  const [st, setSt] = useState('all');
  const base = hosts.filter((h) => matches(query, h.hostname, h.ip, h.os, h.role));
  const filtered = base.filter((h) => st === 'all' || h.status === st);
  const { sorted, sort, onSort } = useSort(filtered, { key: 'risk', dir: 'desc' });
  const c = (s) => base.filter((h) => h.status === s).length;
  return (
    <>
      <PageHead title="Hosts" desc="Domain computers, connectivity, event volume and host-level risk." />
      <Panel flush title="Monitored hosts" subtitle={`${base.length} hosts`} action={<Segmented label="Status" value={st} onChange={setSt} options={[{ value: 'all', label: 'All', count: base.length }, { value: 'Online', label: 'Online', count: c('Online') }, { value: 'Idle', label: 'Idle', count: c('Idle') }, { value: 'Offline', label: 'Offline', count: c('Offline') }]} />}>
        <DataTable rows={sorted} rowKey={(h) => h.hostname} sort={sort} onSort={onSort} empty={<Empty icon={MonitorX} title="No hosts match" />} columns={[
          { key: 'hostname', label: 'Hostname', sortable: true, primary: true, render: (h) => <><span className="cell-strong">{h.hostname}</span>{h.role && <span className="cell-sub">{h.role}</span>}</> },
          { key: 'ip', label: 'IP address', render: (h) => <span className="mono">{h.ip}</span> },
          { key: 'os', label: 'Operating system', render: (h) => h.os },
          { key: 'status', label: 'Status', sortable: true, render: (h) => <StatusBadge status={h.status} /> },
          { key: 'ts', label: 'Last seen', render: (h) => timeAgo(h.ts) },
          { key: 'risk', label: 'Risk', sortable: true, render: (h) => <Risk value={h.risk} /> },
          { key: 'events', label: 'Events', sortable: true, align: 'right', render: (h) => <span className="num">{fmtNum(h.events)}</span> },
        ]} />
      </Panel>
    </>
  );
}
