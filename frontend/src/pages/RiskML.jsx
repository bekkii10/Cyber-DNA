import React, { useState } from 'react';
import { BrainCircuit, HelpCircle, Info, Lightbulb, Cpu } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, DataTable, Risk, RiskBadge, useSort } from '../components/ui';
import { BarChart, LineAreaChart } from '../components/charts';
import { model, riskTrend } from '../data/mock';
import { fmtTime, riskLevel } from '../hooks/utils';
import { matches } from './shared';

export default function RiskML({ query }) {
  const { users } = useData();
  const [sel, setSel] = useState(null);
  const base = users.filter((u) => matches(query, u.username, u.behavior, u.dept));
  const { sorted, sort, onSort } = useSort(base, { key: 'risk', dir: 'desc' });
  const cur = sorted.find((u) => u.username === sel) || sorted[0];
  const bands = [['0–29', 0, 29], ['30–49', 30, 49], ['50–69', 50, 69], ['70–84', 70, 84], ['85–100', 85, 100]];
  const dist = bands.map(([, lo, hi]) => users.filter((u) => u.risk >= lo && u.risk <= hi).length);
  return (
    <>
      <PageHead title="Risk & ML" desc="How Cyber DNA scores behavior: risk score, anomaly score, behavior type and a plain-language explanation for every user." />
      <div className="grid">
        <Panel className="col-4" title="Model information" subtitle="Behavioral analytics engine" action={<span className="node-ico"><BrainCircuit size={18} /></span>}>
          <dl className="kv-list">
            <div><dt>Model</dt><dd>{model.name}</dd></div>
            <div><dt>Version</dt><dd>{model.version}</dd></div>
            <div><dt>Approach</dt><dd>{model.type}</dd></div>
            <div><dt>Baseline window</dt><dd>{model.baselineDays} days</dd></div>
            <div><dt>Anomaly threshold</dt><dd>{model.threshold}</dd></div>
            <div><dt>Last trained</dt><dd>{fmtTime(model.trained)}</dd></div>
          </dl>
          <div className="sub-title" style={{ marginTop: '1rem' }}><Cpu size={13} style={{ verticalAlign: '-2px' }} /> Features used</div>
          <div className="chips">{model.features.map((f) => <span className="chip" key={f}>{f}</span>)}</div>
        </Panel>
        <Panel className="col-8" title="Average risk trend" subtitle="All monitored users, last 9 days">
          <LineAreaChart labels={riskTrend.labels} series={[{ key: 'r', label: 'Avg risk', values: riskTrend.values }]} height={240} forceMax={100} ariaLabel="Average risk score trend" />
        </Panel>
        <Panel className="col-4" title="Users by risk band" subtitle="Count of users per score range">
          <BarChart labels={bands.map((b) => b[0])} values={dist} highlight={[3, 4]} height={210} name="Users" ariaLabel="Users by risk band" />
        </Panel>
        <Panel className="col-8" flush title="Scored users" subtitle="Select a row to read the explanation">
          <DataTable rows={sorted} rowKey={(u) => u.username} sort={sort} onSort={onSort} columns={[
            { key: 'username', label: 'User', sortable: true, primary: true, render: (u) => <button type="button" className="link-btn" style={{ padding: 0, fontSize: '.875rem' }} onClick={() => setSel(u.username)}>{u.username}</button> },
            { key: 'risk', label: 'Risk score', sortable: true, render: (u) => <Risk value={u.risk} /> },
            { key: 'anomaly', label: 'Anomaly score', sortable: true, render: (u) => <span className="num cell-strong">{u.anomaly.toFixed(2)}{u.anomaly >= model.threshold && <span className="cell-sub">above threshold</span>}</span> },
            { key: 'behavior', label: 'Behavior type', render: (u) => u.behavior },
            { key: 'lvl', label: 'Level', render: (u) => <RiskBadge risk={u.risk} /> },
          ]} />
        </Panel>
        {cur && (
          <Panel className="col-12" title={`Explanation — ${cur.username}`} subtitle={`${cur.behavior} · risk ${cur.risk} · anomaly ${cur.anomaly.toFixed(2)} · ${model.version}`}>
            <div className="narrative" style={{ padding: 0 }}>
              <div className="nar n-what"><h3><HelpCircle size={16} color="var(--c1)" />What happened</h3><p>{cur.what}</p></div>
              <div className="nar n-means"><h3><Info size={16} color="var(--med-solid)" />What it means</h3><p>{cur.means}</p></div>
              <div className="nar n-rec"><h3><Lightbulb size={16} color="var(--ok-solid)" />Recommendation</h3><p>{cur.recommendation}</p></div>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
