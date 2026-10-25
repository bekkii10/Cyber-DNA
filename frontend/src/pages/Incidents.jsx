import React, { useState } from 'react';
import { Users, Monitor, FileSearch, SearchX, MoreHorizontal } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Panel, PageHead, SeverityBadge, StatusBadge, Segmented, Empty, DataTable } from '../components/ui';
import { fmtTime, timeAgo } from '../hooks/utils';
import { matches } from './shared';
import { useAssistantContext } from '../components/assistant/AssistantProvider';
import { incidentContext } from '../components/assistant/contextBuilders';
import { openContextMenu } from '../components/interactions/events';
import AnalystExplanation from '../components/AnalystExplanation';

export default function Incidents({ query }) {
  const { incidents } = useData();
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(null);
  const list = incidents.filter((i) => matches(query, i.id, i.title, i.users.join(' '), i.hosts.join(' ')) && (filter === 'all' || (filter === 'open' ? i.status !== 'Resolved' : i.status === 'Resolved')));
  const cur = list.find((i) => i.id === sel) || list[0];
  useAssistantContext({ selection: cur && incidentContext(cur), filters: { status: filter !== 'all' ? filter : undefined } });
  return (
    <>
      <PageHead title="Incidents" desc="Related alerts and events grouped by the correlation engine into security cases." />
      <div className="toolbar"><Segmented label="Status" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All', count: incidents.length }, { value: 'open', label: 'Active', count: incidents.filter((i) => i.status !== 'Resolved').length }, { value: 'resolved', label: 'Resolved', count: incidents.filter((i) => i.status === 'Resolved').length }]} /></div>
      {!cur ? <Panel><Empty icon={SearchX} title="No incidents found" /></Panel> : (
        <div className="md">
          <Panel flush className="md-list" title="Cases">
            <div className="md-scroller">
              {list.map((i) => (
                <button type="button" key={i.id} className={`md-item bar-${i.severity}`} aria-current={cur.id === i.id} onContextMenu={(e) => openContextMenu(e, 'incident', i)} onClick={() => setSel(i.id)} style={{ borderLeftColor: cur.id === i.id ? undefined : 'transparent' }}>
                  <span style={{ flex: 1, minWidth: 0 }}><small className="mono">{i.id} · {timeAgo(i.ts)}</small><b>{i.title}</b><span style={{ display: 'flex', gap: '.4rem', marginTop: '.4rem', flexWrap: 'wrap' }}><SeverityBadge level={i.severity} /><StatusBadge status={i.status} /></span></span>
                </button>
              ))}
            </div>
          </Panel>
          <div style={{ display: 'grid', gap: 'var(--sp-5)', minWidth: 0 }}>
            <Panel flush>
              <div className="detail-head">
                <div style={{ minWidth: 0 }}>
                  <div className="mono muted">{cur.id} · opened {fmtTime(cur.ts)}</div>
                  <div className="incident-detail-title"><h2>{cur.title}</h2><button type="button" className="icon-btn context-more" aria-label={`More actions for ${cur.id}`} title="More actions" onClick={(e) => openContextMenu(e, 'incident', cur)}><MoreHorizontal size={16} /></button></div>
                  <p className="muted" style={{ marginTop: '.4rem', maxWidth: '44rem' }}>{cur.summary}</p>
                </div>
                <div style={{ display: 'flex', gap: '.4rem' }}><SeverityBadge level={cur.severity} /><StatusBadge status={cur.status} /></div>
              </div>
              <div className="detail-grid">
                <div className="detail-block"><div className="sub-title"><Users size={13} style={{ verticalAlign: '-2px' }} /> Affected users</div><div className="chips">{cur.users.map((u) => <span className="chip" key={u}>{u}</span>)}</div></div>
                <div className="detail-block"><div className="sub-title"><Monitor size={13} style={{ verticalAlign: '-2px' }} /> Affected hosts</div><div className="chips">{cur.hosts.map((h) => <span className="chip" key={h}>{h}</span>)}</div></div>
              </div>
            </Panel>
            <div className="grid">
              <Panel className="col-5" title="Timeline" subtitle="Oldest first">
                <ol className="timeline">{[...cur.timeline].sort((a, b) => new Date(a.t) - new Date(b.t)).map((t, i) => <li key={i}><time>{fmtTime(t.t)}</time><span>{t.text}</span></li>)}</ol>
              </Panel>
              <Panel className="col-7" flush title="Related events" subtitle={`${cur.events.length} events linked to this case`}>
                <DataTable rows={cur.events} rowKey={(e) => e.id} onRowContextMenu={(e, event) => openContextMenu(e, 'event', event)} empty={<Empty icon={FileSearch} title="No related events" />} columns={[
                  { key: 'id', label: 'Event', primary: true, render: (e) => <span className="mono cell-strong">{e.id}</span> },
                  { key: 'eventId', label: 'Event ID', render: (e) => e.eventId },
                  { key: 'desc', label: 'Description', render: (e) => e.desc },
                  { key: 'ts', label: 'Time', render: (e) => fmtTime(e.ts) },
                ]} />
              </Panel>
            </div>
            <AnalystExplanation
              context={{ page: 'Incidents', selection: incidentContext(cur) }}
              question={`Explain incident ${cur.id} briefly using only available Cyber DNA evidence. Summarize the incident, explain what the linked alerts/events do and do not establish, and give up to three prioritized investigation steps. Clearly label missing evidence and hypotheses.`}
              title={`AI Analyst explanation · ${cur.id}`}
            />
          </div>
        </div>
      )}
    </>
  );
}
