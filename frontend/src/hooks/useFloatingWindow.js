import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createStore, useStore } from '../lib/createStore';

const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
const read = (key, fallback) => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && ['left', 'top', 'width', 'height'].every((k) => Number.isFinite(saved[k]))) return saved;
  } catch { /* storage can be unavailable */ }
  return fallback();
};
const STEP = 24;
const PHONE = 640;
// A saved rect may come from a bigger screen or a rotated device: always bring it back inside the current viewport.
const fit = (r, minWidth, minHeight) => {
  const vw = window.innerWidth; const vh = window.innerHeight;
  const width = vw <= PHONE ? vw - 16 : clamp(r.width, Math.min(minWidth, vw - 16), vw - 16);
  const height = clamp(r.height, Math.min(minHeight, vh - 16), vh - 16);
  return { width, height, left: vw <= PHONE ? 8 : clamp(r.left, 8, vw - width - 8), top: clamp(r.top, 8, vh - height - 8) };
};
// Which floating window was used last: it is drawn above the others (bounded z-index, no runaway counter).
const focusStore = createStore({ top: null });

export default function useFloatingWindow(key, minWidth = 320, minHeight = 300, defaults = {}) {
  const defaultWidth = defaults.width || 416;
  const defaultHeight = defaults.height || 720;
  const leftOffset = defaults.leftOffset || defaultWidth + 20;
  const defaultTop = defaults.top || 76;
  const [rect, setRect] = useState(() => fit(read(key, () => ({
    left: Math.max(8, window.innerWidth - leftOffset - 8),
    top: defaultTop,
    width: Math.min(defaultWidth, Math.max(minWidth, window.innerWidth - 16)),
    height: Math.min(defaultHeight, Math.max(minHeight, window.innerHeight - defaultTop - 16)),
  })), minWidth, minHeight));
  const [maximized, setMaximized] = useState(false);
  const before = useRef(null);
  const onTop = useStore(focusStore, (s) => s.top === key);

  useEffect(() => {
    if (window.innerWidth <= PHONE) return; // do not overwrite the desktop position with a phone-sized sheet
    try { localStorage.setItem(key, JSON.stringify(maximized && before.current ? before.current : rect)); } catch { /* storage can be full or disabled */ }
  }, [key, rect, maximized]);

  useEffect(() => {
    const resize = () => setRect((r) => fit(r, minWidth, minHeight));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [minWidth, minHeight]);

  const bringToFront = useCallback(() => focusStore.set({ top: key }), [key]);

  const onDragStart = useCallback((event) => {
    if (event.button !== 0 || event.target.closest('button, input, select, textarea, a, [data-no-drag]')) return;
    event.preventDefault();
    bringToFront();
    const startX = event.clientX; const startY = event.clientY;
    const start = { left: rect.left, top: rect.top };
    const move = (e) => setRect((r) => ({ ...r,
      left: clamp(start.left + e.clientX - startX, 8, window.innerWidth - r.width - 8),
      top: clamp(start.top + e.clientY - startY, 8, window.innerHeight - r.height - 8),
    }));
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true });
  }, [rect.left, rect.top, bringToFront]);

  const onResizeStart = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const startX = event.clientX; const startY = event.clientY;
    const start = { width: rect.width, height: rect.height };
    const move = (e) => setRect((r) => ({ ...r,
      width: clamp(start.width + e.clientX - startX, minWidth, window.innerWidth - r.left - 8),
      height: clamp(start.height + e.clientY - startY, minHeight, window.innerHeight - r.top - 8),
    }));
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end, { once: true });
  }, [rect, minWidth, minHeight]);

  // Keyboard alternative to dragging (WCAG 2.5.7): Alt+Arrows move, Alt+Shift+Arrows resize.
  const onKeyDown = useCallback((e) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!e.altKey || !dir || e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    const [dx, dy] = dir;
    setRect((r) => (e.shiftKey
      ? { ...r, width: clamp(r.width + dx * STEP, minWidth, window.innerWidth - r.left - 8), height: clamp(r.height + dy * STEP, minHeight, window.innerHeight - r.top - 8) }
      : { ...r, left: clamp(r.left + dx * STEP, 8, window.innerWidth - r.width - 8), top: clamp(r.top + dy * STEP, 8, window.innerHeight - r.height - 8) }));
  }, [minWidth, minHeight]);

  const style = useMemo(() => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, zIndex: onTop ? 56 : 50 }), [rect, onTop]);
  const resizeTo = useCallback((width, height) => setRect((r) => ({
    ...r, width: clamp(width, minWidth, window.innerWidth - r.left - 8), height: clamp(height, minHeight, window.innerHeight - r.top - 8),
  })), [minWidth, minHeight]);
  const reset = useCallback(() => { setMaximized(false); setRect({
    left: Math.max(8, window.innerWidth - Math.min(defaultWidth, window.innerWidth - 16) - 8),
    top: defaultTop, width: Math.min(defaultWidth, window.innerWidth - 16), height: Math.min(defaultHeight, window.innerHeight - defaultTop - 8),
  }); }, [defaultWidth, defaultHeight, defaultTop]);
  const dock = useCallback((side) => { setMaximized(false); setRect((r) => ({
    ...r, left: side === 'left' ? 8 : Math.max(8, window.innerWidth - r.width - 8), top: defaultTop, height: Math.max(minHeight, window.innerHeight - defaultTop - 8),
  })); }, [defaultTop, minHeight]);
  const toggleMaximize = useCallback(() => {
    if (maximized && before.current) { setRect(before.current); before.current = null; setMaximized(false); return; }
    before.current = rect; setMaximized(true);
    setRect({ left: 8, top: 8, width: window.innerWidth - 16, height: window.innerHeight - 16 });
  }, [maximized, rect]);

  return { rect, style, onDragStart, onResizeStart, onKeyDown, resizeTo, reset, dock, bringToFront, toggleMaximize, maximized };
}
