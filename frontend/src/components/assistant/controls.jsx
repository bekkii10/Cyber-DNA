import React, { useId } from 'react';

// Small accessible form controls shared by the AI and Notebook settings panels.
export function Segmented({ label, value, onChange, options }) {
  const id = useId();
  return (
    <div className="ctl-row">
      <span id={id} className="ctl-label">{label}</span>
      <div className="ctl-seg" role="radiogroup" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export function Switch({ label, hint, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="ctl-row ctl-switch-row">
      <div className="ctl-text"><label htmlFor={id} className="ctl-label">{label}</label>{hint && <small>{hint}</small>}</div>
      <button id={id} type="button" role="switch" aria-checked={!!checked} disabled={disabled} className={`ctl-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><i /></button>
    </div>
  );
}
