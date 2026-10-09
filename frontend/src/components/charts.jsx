import React, { useMemo, useState } from 'react';
import { useWidth } from '../hooks/useDom';
import { fmtNum } from '../hooks/utils';

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const compact = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${n}`);
const COLORS = ['var(--c1)', 'var(--c3)', 'var(--c2)', 'var(--c4)', 'var(--c5)'];

function useScale(width, height, labels, series, { left = 44, right = 12, top = 12, bottom = 28, forceMax } = {}) {
  return useMemo(() => {
    const pw = Math.max(10, width - left - right), ph = height - top - bottom;
    const max = forceMax || niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
    const n = labels.length;
    const x = (i) => left + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const y = (v) => top + ph - (v / max) * ph;
    const ticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
    return { pw, ph, max, x, y, ticks, left, right, top, bottom };
  }, [width, height, labels, series, left, right, top, bottom, forceMax]);
}

const xLabelStep = (n, pw, min = 56) => Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / min))));

export function LineAreaChart({ labels, series, height = 240, area = true, forceMax, valueLabel = (v) => fmtNum(v), ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const sc = useScale(width, height, labels, series, { forceMax });
  const step = xLabelStep(labels.length, sc.pw);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const i = Math.round(((px - sc.left) / sc.pw) * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, i)));
  };
  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${sc.x(i).toFixed(1)},${sc.y(v).toFixed(1)}`).join('');
  const gid = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <div className="chart-box" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseMove={onMove} onTouchMove={onMove} onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--c1)" stopOpacity=".28" /><stop offset="1" stopColor="var(--c1)" stopOpacity="0" /></linearGradient></defs>
        <g className="chart-grid">{sc.ticks.map((t) => <line key={t} x1={sc.left} x2={width - sc.right} y1={sc.y(t)} y2={sc.y(t)} />)}</g>
        <g className="chart-axis">
          {sc.ticks.map((t) => <text key={t} x={sc.left - 8} y={sc.y(t) + 4} textAnchor="end">{compact(Math.round(t * 10) / 10)}</text>)}
          {labels.map((l, i) => (i % step === 0 || i === labels.length - 1) && (i % step === 0 || labels.length - 1 - i >= step / 2) ? <text key={i} x={sc.x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>{l}</text> : null)}
        </g>
        {series.map((s, si) => (
          <g key={s.key}>
            {area && si === 0 && <path d={`${path(s.values)}L${sc.x(labels.length - 1)},${sc.y(0)}L${sc.x(0)},${sc.y(0)}Z`} fill={`url(#${gid})`} />}
            <path d={path(s.values)} fill="none" style={{ stroke: s.color || COLORS[si] }} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={sc.x(hover)} x2={sc.x(hover)} y1={sc.top} y2={sc.top + sc.ph} style={{ stroke: 'var(--border-strong)' }} strokeDasharray="4 3" />
            {series.map((s, si) => <circle key={s.key} cx={sc.x(hover)} cy={sc.y(s.values[hover])} r="4.5" style={{ fill: 'var(--surface)', stroke: s.color || COLORS[si] }} strokeWidth="2.5" />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(sc.x(hover), 70), width - 70), top: Math.max(sc.y(Math.max(...series.map((s) => s.values[hover]))) - 10, 52) }}>
          <b>{labels[hover]}</b>
          {series.map((s, si) => <span key={s.key}><i style={{ background: s.color || COLORS[si] }} />{s.label}: {valueLabel(s.values[hover], s)}</span>)}
        </div>
      )}
    </div>
  );
}

// Vertical bars with an optional comparison line (used for hourly login patterns).
export function BarChart({ labels, values, compare, highlight = [], height = 220, name = 'Today', compareName = 'Baseline', ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const all = [{ values }, ...(compare ? [{ values: compare }] : [])];
  const sc = useScale(width, height, labels, all, { left: 34 });
  const n = labels.length, slot = sc.pw / n, bw = Math.max(3, slot * 0.62);
  const step = xLabelStep(n, sc.pw, 34);
  const cx = (i) => sc.left + slot * i + slot / 2;
  return (
    <div className="chart-box" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        <g className="chart-grid">{sc.ticks.map((t) => <line key={t} x1={sc.left} x2={width - sc.right} y1={sc.y(t)} y2={sc.y(t)} />)}</g>
        <g className="chart-axis">
          {sc.ticks.map((t) => <text key={t} x={sc.left - 8} y={sc.y(t) + 4} textAnchor="end">{Math.round(t)}</text>)}
          {labels.map((l, i) => i % step === 0 && <text key={i} x={cx(i)} y={height - 8} textAnchor="middle">{l}</text>)}
        </g>
        {values.map((v, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={cx(i) - slot / 2} y={sc.top} width={slot} height={sc.ph} fill="transparent" />
            <rect x={cx(i) - bw / 2} y={sc.y(v)} width={bw} height={Math.max(0, sc.y(0) - sc.y(v))} rx="2" style={{ fill: highlight.includes(i) ? 'var(--crit-solid)' : 'var(--c1)', opacity: hover === null || hover === i ? 1 : 0.55 }} />
          </g>
        ))}
        {compare && <path d={compare.map((v, i) => `${i ? 'L' : 'M'}${cx(i)},${sc.y(v)}`).join('')} fill="none" strokeWidth="2" strokeDasharray="5 4" style={{ stroke: 'var(--c4)' }} />}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(cx(hover), 70), width - 70), top: Math.max(sc.y(Math.max(values[hover], compare?.[hover] || 0)) - 8, 52) }}>
          <b>{labels[hover]}</b>
          <span><i style={{ background: highlight.includes(hover) ? 'var(--crit-solid)' : 'var(--c1)' }} />{name}: {values[hover]}</span>
          {compare && <span><i style={{ background: 'var(--c4)' }} />{compareName}: {compare[hover]}</span>}
        </div>
      )}
    </div>
  );
}

export function Donut({ segments, centerLabel, centerValue }) {
  const [active, setActive] = useState(null);
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;
  const shown = active !== null ? segments[active] : null;
  return (
    <div className="donut-wrap">
      <div className="donut-svg">
        <svg viewBox="0 0 100 100" role="img" aria-label={`Distribution: ${segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}>
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="13" style={{ stroke: 'var(--surface-3)' }} />
          {segments.map((s, i) => {
            const len = (s.value / total) * C;
            const el = <circle key={s.label} cx="50" cy="50" r={R} fill="none" strokeWidth={active === i ? 15 : 13} strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`} strokeDashoffset={-offset} style={{ stroke: s.color || COLORS[i % COLORS.length], transition: 'stroke-width .15s' }} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />;
            offset += len;
            return el;
          })}
        </svg>
        <div className="donut-center"><b>{shown ? `${Math.round((shown.value / total) * 100)}%` : centerValue}</b><small>{shown ? shown.label : centerLabel}</small></div>
      </div>
      <div className="dlist">
        {segments.map((s, i) => (
          <button key={s.label} type="button" className={active === i ? 'on' : ''} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
            <i style={{ background: s.color || COLORS[i % COLORS.length] }} /><span>{s.label}</span><b>{fmtNum(s.value)}</b><span className="pc">{Math.round((s.value / total) * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, color = 'var(--c1)', height = 32 }) {
  const w = 100, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d={`${d}L${w},${height}L0,${height}Z`} style={{ fill: color }} opacity=".12" />
      <path d={d} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />
    </svg>
  );
}

// Half-ring gauge for overall threat level (0–100).
export function Gauge({ value, level, label }) {
  const R = 42, L = Math.PI * R;
  return (
    <div className={`gauge bar-${level}`} role="img" aria-label={`${label}: ${value} out of 100`}>
      <svg viewBox="0 0 100 56">
        <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="9" strokeLinecap="round" style={{ stroke: 'var(--surface-3)' }} />
        <path d="M8 50 A42 42 0 0 1 92 50" fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(value / 100) * L} ${L}`} style={{ stroke: 'var(--bar)' }} />
      </svg>
      <div className="gauge-center"><b>{value}</b><small>/ 100</small></div>
    </div>
  );
}

export const StackBar = ({ items }) => {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  return <div className="stackbar" role="img" aria-label={items.map((i) => `${i.label} ${i.value}`).join(', ')}>{items.filter((i) => i.value).map((i) => <span key={i.label} className={`bar-${i.key}`} style={{ flex: i.value / total }} />)}</div>;
};
