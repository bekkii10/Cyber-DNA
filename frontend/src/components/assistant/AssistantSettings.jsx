import React from 'react';
import { PanelLeftClose, PanelRightClose, RotateCcw, ShieldCheck } from 'lucide-react';
import { Segmented, Switch } from './controls';
import { setAiSettings, resetAiSettings, useAiSettings } from './assistantSettings';

export default function AssistantSettings({ floating, onClose }) {
  const s = useAiSettings();
  return (
    <div className="as-settings" role="dialog" aria-label="AI Analyst settings" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="as-settings-head"><strong>AI Analyst settings</strong><button type="button" className="as-link" onClick={onClose}>Done</button></div>
      <div className="as-settings-body">
        <section aria-labelledby="ai-set-answers">
          <h4 id="ai-set-answers">Answers</h4>
          <Segmented label="Response style" value={s.responseStyle} onChange={(v) => setAiSettings({ responseStyle: v })} options={[['concise', 'Concise'], ['balanced', 'Balanced'], ['detailed', 'Detailed']]} />
          <Segmented label="Written for" value={s.audience} onChange={(v) => setAiSettings({ audience: v })} options={[['analyst', 'Analyst'], ['executive', 'Executive']]} />
          <Segmented label="Earlier messages sent" value={s.historyTurns} onChange={(v) => setAiSettings({ historyTurns: v })} options={[[0, 'None'], [6, '6'], [12, '12'], [24, '24']]} />
        </section>
        <section aria-labelledby="ai-set-privacy">
          <h4 id="ai-set-privacy">Context and privacy</h4>
          <Switch label="Attach page context by default" hint="Page, filters and the selected item." checked={s.includePageContext} onChange={(v) => setAiSettings({ includePageContext: v })} />
          <Switch label="Attach the open Notebook note" hint="An excerpt is sent with each question. TLP:RED notes are never sent." checked={s.includeNote} onChange={(v) => setAiSettings({ includeNote: v })} />
          <Switch label="Mask IPs, users and hosts" hint="Replaced with placeholders before sending and restored in answers. Names typed in free text are not detected." checked={s.redact} onChange={(v) => setAiSettings({ redact: v })} />
        </section>
        <section aria-labelledby="ai-set-ui">
          <h4 id="ai-set-ui">Interface</h4>
          <Segmented label="Send with" value={s.sendKey} onChange={(v) => setAiSettings({ sendKey: v })} options={[['enter', 'Enter'], ['mod-enter', 'Ctrl/⌘ + Enter']]} />
          <Switch label="Compact messages" checked={s.compact} onChange={(v) => setAiSettings({ compact: v })} />
          <Switch label="Selection actions" hint="Show Ask AI and Add to Notebook when you select text on the page." checked={s.selectionToolbar} onChange={(v) => setAiSettings({ selectionToolbar: v })} />
          <Switch label="Show timestamps" checked={s.showTimestamps} onChange={(v) => setAiSettings({ showTimestamps: v })} />
        </section>
        <section aria-labelledby="ai-set-win">
          <h4 id="ai-set-win">Window</h4>
          <div className="ctl-btns">
            <button type="button" onClick={() => floating.dock('left')}><PanelLeftClose size={14} /> Dock left</button>
            <button type="button" onClick={() => floating.dock('right')}><PanelRightClose size={14} /> Dock right</button>
            <button type="button" onClick={floating.reset}><RotateCcw size={14} /> Reset position</button>
          </div>
          <small className="ctl-note">Move with Alt + arrow keys, resize with Alt + Shift + arrows.</small>
        </section>
      </div>
      <div className="as-settings-foot"><span><ShieldCheck size={13} /> Saved in this browser only.</span><button type="button" className="as-link" onClick={resetAiSettings}>Reset to defaults</button></div>
    </div>
  );
}
