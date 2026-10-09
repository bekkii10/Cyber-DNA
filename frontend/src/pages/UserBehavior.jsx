import React, { useState } from 'react';
import { Clock, Laptop, Network, AlertTriangle, HelpCircle, Lightbulb, SearchX, Info, Repeat } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, Avatar, Risk, RiskBadge, SeverityBadge, Empty } from '../components/ui';
import { BarChart, LineAreaChart } from '../components/charts';
import { riskLevel, fmtTime } from '../hooks/utils';
import { matches } from './shared';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const Trend = ({ t }) => <span className={`trend ${t}`} aria-label={`Trend ${t}`}>{t === 'up' ? '▲' : t === 'down' ? '▼' : '►'}</span>;

export default function UserBehavior({ query }) {
  const { users } = useData();
  const [sel, setSel] = useState(null);
  const list = [...users].filter((u) => matches(query, u.username, u.display, u.dept, u.behavior)).sort((a, b) => b.risk - a.risk);
  const u = list.find((x) => x.username === sel) || list[0];
  if (!u) return <><PageHead title="User behavior" /><Panel><Empty icon={SearchX} title="No users match your search" /></Panel></>;
  const lvl = riskLevel(u.risk);
  const odd = u.hourlyToday.map((v, h) => (v > (u.hourlyBaseline[h] || 0) + 2 ? h : -1)).filter((h) => h >= 0);
  const newItems = [...u.knownComputers.filter((c) => c.isNew).map((c) => `New computer: ${c.name}`), ...u.knownIps.filter((c) => c.isNew).map((c) => `New source IP: ${c.name}`), ...(odd.length ? [`Off-baseline logins at ${odd.map((h) => `${HOURS[h]}:00`).join(', ')}`] : [])];
  return (
    <>
      <PageHead title="User behavior" desc="Compare each Active Directory user’s activity with their learned baseline to spot account misuse early." />
      <div className="md">
        <Panel flush className="md-list" title="Monitored users" subtitle="Sorted by risk">
          <div className="md-scroller">
            {list.map((x) => (
              <button type="button" key={x.username} className={`md-item bar-${riskLevel(x.risk)}`} aria-current={u.username === x.username} onClick={() => setSel(x.username)}>
                <Avatar name={x.username} size="sm" />
                <span style={{ flex: 1, minWidth: 0 }}><b>{x.username}</b><small>{x.dept}</small></span>
                <span style={{ display: 'grid', justifyItems: 'end', gap: '.15rem' }}><b className="num" style={{ color: `var(--${lvl === 'ok' ? 'ok' : riskLevel(x.risk)})` }}>{x.risk}</b><Trend t={x.trend} /></span>
              </button>
            ))}
          </div>
        </Panel>

        <div style={{ display: 'grid', gap: 'var(--sp-5)', minWidth: 0 }}>
          <Panel flush>
            <div className="detail-head">
              <div className="who"><Avatar name={u.username} size="lg" /><div style={{ minWidth: 0 }}><h2>{u.display}</h2><div className="muted">{u.username} · {u.dept}</div><div style={{ marginTop: '.5rem', display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}><RiskBadge risk={u.risk} /><span className="badge plain"><Repeat size={12} />{u.behavior}</span></div></div></div>
              <div className={`risk-xl bar-${lvl}`} style={{ minWidth: '11rem' }}>
                <div className="muted" style={{ fontWeight: 600, fontSize: '.75rem' }}>RISK SCORE</div>
                <div className="score">{u.risk}<small> / 100</small></div>
                <span className="risk-track"><i style={{ width: `${u.risk}%` }} /></span>
                <small className="muted">Anomaly score {u.anomaly.toFixed(2)} · last seen {fmtTime(u.ts)}</small>
              </div>
            </div>
            <div className="narrative">
              <div className="nar n-what"><h3><HelpCircle size={16} color="var(--c1)" />What happened?</h3><p>{u.what}</p></div>
              <div className="nar n-means"><h3><Info size={16} color="var(--med-solid)" />What does it mean?</h3><p>{u.means}</p></div>
              <div className="nar n-rec"><h3><Lightbulb size={16} color="var(--ok-solid)" />Recommendation</h3><p>{u.recommendation}</p></div>
            </div>
          </Panel>

          <div className="grid">
            <Panel className="col-7" title="Login pattern by hour" subtitle="Today compared with this user’s 30-day baseline">
              <BarChart labels={HOURS} values={u.hourlyToday} compare={u.hourlyBaseline} highlight={odd} height={230} name="Today" compareName="Baseline" ariaLabel={`Hourly logins for ${u.username}`} />
              <div className="legend" style={{ marginTop: '.5rem' }}><span><i style={{ background: 'var(--c1)' }} />Today</span><span><i style={{ background: 'var(--crit-solid)' }} />Outside baseline</span><span><i style={{ background: 'var(--c4)' }} />Baseline</span></div>
            </Panel>
            <Panel className="col-5" title="Risk trend" subtitle="Last 9 days">
              {u.riskTrend.length ? <LineAreaChart labels={u.riskTrend.map((_, i) => (i === u.riskTrend.length - 1 ? 'Today' : `-${u.riskTrend.length - 1 - i}d`))} series={[{ key: 'risk', label: 'Risk', values: u.riskTrend }]} height={230} forceMax={100} ariaLabel={`Risk trend for ${u.username}`} /> : <Empty title="No history" />}
            </Panel>

            <Panel className="col-5" title="Normal behavior" subtitle="Learned baseline">
              <dl className="kv-list">
                <div><dt><Clock size={14} style={{ verticalAlign: '-2px' }} /> Usual hours</dt><dd>{u.baseline.hours}</dd></div>
                <div><dt>Logins per day</dt><dd>{u.baseline.loginsPerDay}</dd></div>
                <div><dt>Usual computers</dt><dd>{u.baseline.computers.join(', ') || '—'}</dd></div>
                <div><dt>Usual source IPs</dt><dd className="mono">{u.baseline.ips.join(', ') || '—'}</dd></div>
              </dl>
            </Panel>
            <Panel className="col-7" title="Known computers and source IPs" subtitle="Highlighted items were never seen before">
              <div className="sub-title"><Laptop size={13} style={{ verticalAlign: '-2px' }} /> Computers</div>
              <div className="chips" style={{ marginBottom: '1rem' }}>{u.knownComputers.map((c) => <span key={c.name} className={`chip ${c.isNew ? 'new' : ''}`}>{c.name}{c.isNew && <small>New</small>}</span>)}</div>
              <div className="sub-title"><Network size={13} style={{ verticalAlign: '-2px' }} /> Source IPs</div>
              <div className="chips">{u.knownIps.map((c) => <span key={c.name} className={`chip mono ${c.isNew ? 'new' : ''}`}>{c.name}{c.isNew && <small>New</small>}</span>)}</div>
            </Panel>

            <Panel className="col-6" title="Unusual activity" subtitle="Deviations from baseline">
              {newItems.length ? <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: '.5rem' }}>{newItems.map((t) => <li key={t} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}><AlertTriangle size={16} color="var(--high-solid)" style={{ flex: 'none', marginTop: 2 }} />{t}</li>)}</ul> : <Empty title="Nothing unusual" text="Activity matches the baseline." />}
            </Panel>
            <Panel className="col-6" title="Recent anomalies" subtitle={`${u.anomalies.length} detected`}>
              {u.anomalies.length ? u.anomalies.map((a, i) => <div className="anom" key={i}><SeverityBadge level={a.severity} /><div><b style={{ fontWeight: 600 }}>{a.text}</b><small>{fmtTime(a.ts)}</small></div></div>) : <Empty title="No anomalies" />}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
