import React, { useMemo } from 'react';
import { BellRing, BriefcaseBusiness, UserRoundX, ArrowRight, TrendingUp, ShieldAlert, Database } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, Segmented, Risk, Avatar, SeverityBadge, StatusBadge, PageHead } from '../components/ui';
import { LineAreaChart, Donut, Sparkline, Gauge } from '../components/charts';
import { fmtNum, timeAgo } from '../hooks/utils';
import { AlertRow, ICONS } from './shared';
import { services } from '../data/mock';

const LEVELS = [[80, 'critical', 'Critical'], [60, 'high', 'Elevated'], [35, 'medium', 'Guarded'], [0, 'ok', 'Healthy']];

export default function Overview({ range, setRange, go, highRiskBanner }) {
  const { alerts, incidents, users, overview, activity, live } = useData();
  const m = useMemo(() => {
    const open = alerts.filter((a) => a.status !== 'Resolved');
    const by = (s) => open.filter((a) => a.severity === s).length;
    const hiUsers = users.filter((u) => u.risk >= 70);
    const openInc = incidents.filter((i) => i.status !== 'Resolved');
    const score = Math.min(100, by('critical') * 22 + by('high') * 12 + by('medium') * 4 + hiUsers.length * 5);
    const [, level, label] = LEVELS.find(([t]) => score >= t);
    return { open, crit: by('critical'), high: by('high'), hiUsers, openInc, score, level, label, critInc: openInc.filter((i) => i.severity === 'critical').length };
  }, [alerts, incidents, users]);

  const critical = m.open.filter((a) => a.severity === 'critical' || a.severity === 'high').slice(0, 5);
  const ev = activity.series.find((s) => s.key === 'events') || activity.series[0];
  const al = activity.series.find((s) => s.key === 'alerts');
  const peakIdx = ev.values.indexOf(Math.max(...ev.values));
  const statement = m.crit + m.high === 0 ? 'No critical or high-severity alerts are open.' : `${m.crit} critical and ${m.high} high-severity alerts are open${m.critInc ? `, with ${m.critInc} critical incident${m.critInc > 1 ? 's' : ''} under investigation` : ''}.`;
  const riskTrendAvg = users[0]?.riskTrend?.length ? users[0].riskTrend : [10, 12, 14];
  const segs = overview.distribution.map((d) => d);

  return (
    <>
      <PageHead title="Security overview" desc="Behavioral threat analytics across your Active Directory environment." />
      {highRiskBanner && m.crit > 0 && (
        <div className="alert-banner" role="alert"><ShieldAlert size={20} /><span>{m.crit} critical alert{m.crit > 1 ? 's' : ''} need{m.crit === 1 ? 's' : ''} attention — most recent {timeAgo(m.open.find((a) => a.severity === 'critical').ts)}.</span><button className="btn btn-danger btn-sm" onClick={() => go('Alerts')}>Review alerts</button></div>
      )}

      <section className="panel posture" aria-label="Security posture">
        <div className="posture-state">
          <Gauge value={m.score} level={m.level} label="Threat level" />
          <div>
            <div className="eyebrow">Overall security state</div>
            <h2>{m.label}</h2>
            <p>{statement}</p>
          </div>
        </div>
        <div className="posture-stats">
          <button type="button" className="pstat" onClick={() => go('Alerts')} aria-label="Total events">
            <span className="lbl"><Database size={16} color="var(--c1)" />Total events</span>
            <span className="val">{fmtNum(overview.totalEvents)}</span>
            <span className="sub"><span className="delta neutral"><TrendingUp size={12} /> {overview.eventsDelta}%</span> vs. previous period</span>
            <span className="spark"><Sparkline values={ev.values} color="var(--c1)" /></span>
          </button>
          <button type="button" className="pstat" onClick={() => go('Alerts')}>
            <span className="lbl"><BellRing size={16} color="var(--high-solid)" />Active alerts</span>
            <span className="val">{m.open.length}</span>
            <span className="sub"><span className="delta up-bad">{m.crit} critical</span> · {m.high} high</span>
            <span className="spark"><Sparkline values={(al || ev).values} color="var(--high-solid)" /></span>
          </button>
          <button type="button" className="pstat" onClick={() => go('Incidents')}>
            <span className="lbl"><BriefcaseBusiness size={16} color="var(--c2)" />Open incidents</span>
            <span className="val">{m.openInc.length}</span>
            <span className="sub">{m.critInc} critical · {m.openInc.filter((i) => i.status === 'Investigating').length} investigating</span>
            <span className="spark"><Sparkline values={[1, 1, 2, 2, 3, 3, 4, m.openInc.length]} color="var(--c2)" /></span>
          </button>
          <button type="button" className="pstat" onClick={() => go('User Behavior')}>
            <span className="lbl"><UserRoundX size={16} color="var(--crit-solid)" />High-risk users</span>
            <span className="val">{m.hiUsers.length}</span>
            <span className="sub">risk score 70 or above</span>
            <span className="spark"><Sparkline values={riskTrendAvg} color="var(--crit-solid)" /></span>
          </button>
        </div>
      </section>

      <div className="grid">
        <Panel className="col-8" title="Event activity" subtitle={`Peak ${fmtNum(ev.values[peakIdx])} events at ${activity.labels[peakIdx]}${live ? '' : ' · demo data'}`}
          action={<Segmented label="Time range" value={range} onChange={setRange} options={[{ value: '24h', label: '24h' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }]} />}>
          <LineAreaChart labels={activity.labels} series={[{ ...ev, color: 'var(--c1)', label: 'Events' }]} height={250} ariaLabel={`Event activity over ${range}`} />
          <div className="legend" style={{ marginTop: '.5rem' }}><span><i style={{ background: 'var(--c1)' }} />Events per {range === '24h' ? 'hour' : 'day'}</span></div>
        </Panel>
        <Panel className="col-4" title="Event distribution" subtitle="By Windows event category">
          <Donut segments={segs} centerValue={fmtNum(overview.totalEvents)} centerLabel="Total events" />
        </Panel>

        <Panel className="col-7" flush title="Recent critical alerts" subtitle="Critical and high severity, newest first" action={<button className="link-btn" onClick={() => go('Alerts')}>View all <ArrowRight size={14} /></button>}>
          <div className="rows">{critical.length ? critical.map((a) => <AlertRow key={a.id} a={a} onClick={() => go('Alerts')} />) : <div className="empty"><b>No critical alerts</b></div>}</div>
        </Panel>
        <Panel className="col-5" flush title="High-risk users" subtitle="Behavior deviating from baseline" action={<button className="link-btn" onClick={() => go('User Behavior')}>View all <ArrowRight size={14} /></button>}>
          <div className="rows">
            {[...users].sort((a, b) => b.risk - a.risk).slice(0, 4).map((u) => (
              <button type="button" key={u.username} className="row" onClick={() => go('User Behavior')}>
                <Avatar name={u.username} size="sm" />
                <span className="grow"><span className="ttl">{u.username}</span><span className="meta"><span>{u.behavior}</span></span></span>
                <Risk value={u.risk} />
              </button>
            ))}
          </div>
        </Panel>

       </div>
    </>
  );
}


