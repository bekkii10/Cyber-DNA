import React from 'react';
import { Clock3, MapPin, Server, UserRound, Radio, CloudCog, Database, ShieldCheck, GitMerge, BrainCircuit, Hash } from 'lucide-react';
import { SeverityBadge, StatusBadge } from '../components/ui';
import { timeAgo } from '../hooks/utils';

export const matches = (q, ...fields) => !q.trim() || fields.some((f) => String(f ?? '').toLowerCase().includes(q.trim().toLowerCase()));
export const ICONS = { Radio, CloudCog, Database, ShieldCheck, GitMerge, BrainCircuit };

export const AlertRow = ({ a, onClick }) => (
  <button type="button" className={`row bar-${a.severity}`} onClick={onClick}>
    <span className="sev-rail" aria-hidden="true" />
    <span className="grow">
      <span className="ttl">{a.title}</span>
      <span className="meta">
        <span><Hash size={12} />Event {a.eventId}</span>
        <span><UserRound size={12} />{a.user}</span>
        <span><MapPin size={12} />{a.ip}</span>
        <span><Server size={12} />{a.host}</span>
        <span><Clock3 size={12} />{timeAgo(a.ts)}</span>
      </span>
    </span>
    <span className="side"><SeverityBadge level={a.severity} /><StatusBadge status={a.status} /></span>
  </button>
);
