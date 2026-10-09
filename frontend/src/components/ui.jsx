import React, { useEffect } from 'react';
import { X, SearchX, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cap, initials, riskLevel } from '../hooks/utils';

export const SeverityBadge = ({ level }) => <span className={`badge sev-${level}`}><i />{cap(level)}</span>;
export const StatusBadge = ({ status }) => <span className={`badge st-${String(status).toLowerCase()}`}>{status}</span>;
export const RiskBadge = ({ risk }) => { const l = riskLevel(risk); return <span className={`badge sev-${l}`}><i />{l === 'ok' ? 'Normal' : cap(l)}</span>; };

export function Panel({ title, subtitle, action, children, className = '', flush = false, as: Tag = 'section' }) {
  return (
    <Tag className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          <div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>
          {action}
        </div>
      )}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </Tag>
  );
}

export const PageHead = ({ title, desc, actions }) => (
  <div className="page-head"><div><h1>{title}</h1>{desc && <p>{desc}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
);

export const Avatar = ({ name, size = '' }) => <span className={`avatar ${size}`} aria-hidden="true">{initials(name)}</span>;

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return <button key={opt.value} type="button" aria-pressed={value === opt.value} onClick={() => onChange(opt.value)}>{opt.label}{opt.count !== undefined && <span className="cnt">{opt.count}</span>}</button>;
      })}
    </div>
  );
}

export const Risk = ({ value }) => (
  <span className={`risk bar-${riskLevel(value)}`} title={`Risk score ${value}`}>
    <b>{value}</b><span className="risk-track"><i style={{ width: `${Math.min(100, value)}%` }} /></span>
  </span>
);

export const Empty = ({ icon: Icon = SearchX, title = 'Nothing to show', text }) => (
  <div className="empty"><Icon size={28} aria-hidden="true" /><b>{title}</b>{text && <span>{text}</span>}</div>
);

export const Toggle = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className="toggle" onClick={() => onChange(!on)} />
);

export function Modal({ title, desc, onClose, children, footer, small }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="modal-shade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${small ? 'sm' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h2>{title}</h2>{desc && <p>{desc}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Responsive table: on narrow screens each row becomes a labelled card.
export function DataTable({ columns, rows, rowKey, sort, onSort, empty }) {
  if (!rows.length) return empty || <Empty />;
  return (
    <div className="table-wrap">
      <table className="table stack">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'right' : ''} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sortable ? (
                  <button type="button" onClick={() => onSort(c.key)}>
                    {c.label}
                    {sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} />}
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => <td key={c.key} data-label={c.label} className={`${c.primary ? 'primary' : ''} ${c.align === 'right' ? 'right' : ''}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useSort(rows, initial) {
  const [sort, setSort] = React.useState(initial);
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  const sorted = React.useMemo(() => {
    const m = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => (a[sort.key] > b[sort.key] ? m : a[sort.key] < b[sort.key] ? -m : 0));
  }, [rows, sort]);
  return { sorted, sort, onSort };
}
