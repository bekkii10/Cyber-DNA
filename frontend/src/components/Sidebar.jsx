import React from 'react';
import { LayoutDashboard, Bell, BriefcaseBusiness, Users, Monitor, ShieldCheck, BrainCircuit, Network, Settings2, Radio, Database, CloudCog, X } from 'lucide-react';
import { Brand } from './Brand';

export const NAV = [
  { group: 'Monitor', items: [['Overview', LayoutDashboard], ['Alerts', Bell], ['Incidents', BriefcaseBusiness]] },
  { group: 'Analyze', items: [['User Behavior', Users], ['Hosts', Monitor], ['Detection Rules', ShieldCheck], ['Risk & ML', BrainCircuit]] },
  { group: 'Platform', items: [['Architecture', Network]] },
];

const STATES = { online: ['pulse', 'Online'], demo: ['warn', 'Demo'], offline: ['off', 'Offline'] };
const StatusRow = ({ icon: Icon, name, state }) => (
  <div className="side-status"><Icon size={15} aria-hidden="true" /><span>{name}</span><span className="state"><span className={`dot ${STATES[state][0]}`} />{STATES[state][1]}</span></div>
);

export default function Sidebar({ page, go, open, close, openSettings, alertCount, status }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} id="sidebar" aria-label="Primary">
      <div className="brand-row">
        <Brand onClick={() => go('Overview')} />
        <button type="button" className="side-close" aria-label="Close menu" onClick={close}><X size={20} /></button>
      </div>
      
      <nav aria-label="Main navigation">
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-label">{g.group}</div>
            {g.items.map(([name, Icon]) => (
              <button key={name} type="button" className={`nav-item ${page === name ? 'active' : ''}`} aria-current={page === name ? 'page' : undefined} onClick={() => go(name)}>
                <Icon size={18} aria-hidden="true" /><span>{name}</span>
                {name === 'Alerts' && alertCount > 0 && <span className="nav-count" aria-label={`${alertCount} new alerts`}>{alertCount}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-bottom">
        <StatusRow icon={Radio} name="Collector" state={status.collector} />
        <StatusRow icon={CloudCog} name="API" state={status.api} />
        <StatusRow icon={Database} name="Database" state={status.database} />
        <button type="button" className="nav-item" onClick={openSettings} style={{ marginTop: '.4rem' }}><Settings2 size={18} aria-hidden="true" /><span>Settings</span></button>
      </div>
    </aside>
  );
}
