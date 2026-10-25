import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Share2, ShieldAlert, X } from 'lucide-react';
import { exportNote, safeFile } from '../../notebook/exporters';
import { extractEntities, ENTITY_LABEL } from '../../notebook/entities';
import { htmlToText } from '../../notebook/sanitize';
import { tlpOf } from '../../notebook/securityKB';
import { downloadText, copyToClipboard } from '../../notebook/download';
import { TlpBadge } from './NotebookDrawer';

// Sharing gate: shows the classification and what the note contains, and requires an explicit confirmation for restricted TLP levels.
export default function ShareDialog({ note, settings, onClose }) {
  const t = tlpOf(note.tlp);
  const found = useMemo(() => extractEntities(htmlToText(note.html)), [note.html]);
  const counts = ['ipv4', 'hash', 'email', 'url', 'sid'].map((k) => [k, found.filter((e) => e.type === k).length]).filter(([, n]) => n);
  const [defangOn, setDefangOn] = useState(settings.defangExports);
  const [ack, setAck] = useState(!t.restricted);
  const [msg, setMsg] = useState('');
  const first = useRef(null);
  const red = note.tlp === 'RED';
  const text = () => exportNote(note, 'md', { defangIocs: defangOn, banner: true }); // banner is always included when sharing
  useEffect(() => { first.current?.focus(); }, []);

  const copy = async () => setMsg((await copyToClipboard(text())) ? 'Copied. Paste it only into a channel approved for this TLP level.' : 'Copy was blocked by the browser. Use Download instead.');
  const share = async () => { try { await navigator.share({ title: note.title, text: text() }); onClose(); } catch { /* the share sheet was dismissed */ } };
  const dl = () => { downloadText(`${safeFile(note.title)}.md`, text(), 'md'); setMsg('Downloaded.'); };

  return (
    <div className="sn-share-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="sn-share-dialog" role="dialog" aria-modal="true" aria-labelledby="sn-share-title">
        <div className="sn-share-dialog-head"><ShieldAlert size={20} aria-hidden="true" /><strong id="sn-share-title">Review before sharing</strong><button ref={first} type="button" className="sn-icon" onClick={onClose} aria-label="Cancel sharing"><X size={16} /></button></div>
        <p className="sn-share-tlp"><TlpBadge id={note.tlp} /> <span>{t.hint}</span></p>
        <p>{counts.length ? <>This note contains {counts.map(([k, n], i) => <span key={k}>{i ? ', ' : ''}<b>{n}</b> {ENTITY_LABEL[k].toLowerCase()}{n > 1 ? (k === 'hash' ? 'es' : 's') : ''}</span>)}.</> : 'No IP addresses, hashes, emails, URLs or SIDs were detected.'} Remove usernames, hostnames and unapproved evidence that these checks cannot see.</p>
        <label className="nb-check"><input type="checkbox" checked={defangOn} onChange={(e) => setDefangOn(e.target.checked)} /> Defang indicators (hxxp, [.])</label>
        {t.restricted && <label className="nb-check sn-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I confirm every recipient is permitted under {t.label}.</label>}
        {red && <p className="sn-share-warn" role="note">TLP:RED is for named recipients only. Copying and the share sheet are disabled; download the file and send it through an approved channel.</p>}
        {msg && <p className="sn-share-msg" role="status">{msg}</p>}
        <div className="sn-share-actions">
          <button type="button" className="sn-cancel" onClick={onClose}>Close</button>
          <button type="button" className="sn-cancel" onClick={dl} disabled={!ack}><Download size={14} /> Download .md</button>
          <button type="button" className="sn-cancel" onClick={copy} disabled={!ack || red}>Copy text</button>
          {typeof navigator !== 'undefined' && navigator.share && <button type="button" className="sn-share" onClick={share} disabled={!ack || red}><Share2 size={14} /> Share…</button>}
        </div>
      </div>
    </div>
  );
}
