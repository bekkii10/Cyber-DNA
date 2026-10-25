import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Dropdown opened from a visible button. Portaled so window overflow never clips it; keyboard navigable; closes on Esc / outside click.
export function MenuButton({ icon: Icon, label, text, items, className = 'sn-tb', title, groupLabels = true }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef(null); const menu = useRef(null);
  const close = useCallback(() => { setOpen(false); btn.current?.focus(); }, []);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = menu.current?.offsetWidth || 240; const h = menu.current?.offsetHeight || 260;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    setPos({ left, top });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return undefined;
    menu.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    const out = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', out);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('pointerdown', out); window.removeEventListener('resize', close); };
  }, [open, close]);

  const onKey = (e) => {
    const nodes = [...menu.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    const i = nodes.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); nodes[(i + 1) % nodes.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); nodes[(i + nodes.length - 1) % nodes.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); nodes[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); nodes[nodes.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  let lastGroup;
  return (
    <>
      <button ref={btn} type="button" className={`${className} sn-menu-btn`} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={title || label} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
        {Icon && <Icon size={15} aria-hidden="true" />}{text && <span>{text}</span>}<ChevronDown size={11} aria-hidden="true" className="sn-caret" />
      </button>
      {open && createPortal(
        <div ref={menu} className="sn-menu" role="menu" aria-label={label} style={{ left: pos.left, top: pos.top }} onKeyDown={onKey}>
          {items.map((it) => {
            const head = groupLabels && it.group && it.group !== lastGroup ? <div key={`g-${it.group}`} className="sn-menu-group" role="presentation">{it.group}</div> : null;
            lastGroup = it.group;
            const I = it.icon;
            return (
              <React.Fragment key={it.id}>
                {head}
                <button type="button" role="menuitem" className="sn-menu-item" disabled={it.disabled} title={it.disabled ? it.disabledReason : undefined} onClick={() => { setOpen(false); it.onSelect(); }}>
                  {I && <I size={14} aria-hidden="true" />}<span className="sn-menu-text"><b>{it.label}</b>{it.hint && <small>{it.hint}</small>}</span>{it.kbd && <kbd>{it.kbd}</kbd>}
                </button>
              </React.Fragment>
            );
          })}
        </div>, document.body)}
    </>
  );
}
