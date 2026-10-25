# Advanced AI Analyst, Security Notebook and click flexibility

Scope: AI Analyst, Security Notebook, and how quickly an analyst can reach them from anywhere in the dashboard. Overview, Alerts, Incidents, User Behavior, Hosts, Rules, Risk & ML pages, authentication, profile menu and the search bar design were not changed.

## Research that drove the design
| Question | Finding | Decision |
|---|---|---|
| How does Notion AI expose AI? | Three entry points: select text then Ask AI with presets, a `/ai` slash block, and chat that knows the page. | Same three entry points, built original: selection bubble, `/` menu with AI group, panel with context chips. |
| Is `contentEditable` + `document.execCommand` a safe editor base? | No. It is deprecated, inconsistent across browsers, and a W3C editing working-group thread treats it as unsuitable for rich text. Production teams use ProseMirror-based editors (Tiptap, Lexical). | Notebook editor rebuilt on **Tiptap/ProseMirror**: real undo/redo, tables, task lists, schema-validated paste. Lazy-loaded, so initial dashboard load is unaffected. |
| What do SOC and DFIR notes need? | UTC timelines, separation of observation vs hypothesis vs finding, IOC tables, ATT&CK mapping, chain of custody, TLP marking, reports with scope/root cause/recommendations. | Callout blocks, security tables, 11 templates, reference library, IOC extractor, TLP-aware sharing. |
| What makes a Linear-class interface flexible? | Menus are never the only path (visible mirror button), the menu key and long-press open the same menu, shortcut hints sit inline, menus flip at screen edges, and everything is reachable from one palette. | All implemented; see below. |

## AI Analyst
* **Settings** (gear): response style (concise/balanced/detailed), audience (analyst/executive), earlier messages sent (0/6/12/24), attach page context by default, attach open note, **mask IPs/users/hosts**, send key (Enter or Ctrl/Cmd+Enter), compact density, timestamps, selection actions, dock/reset window. Saved in this browser only.
* **Masking**: IPs, users and hosts known from the context (plus any IPv4) are replaced by `IP-1`, `USER-1`, `HOST-1` before the request and restored in the answer locally. Free-text names the browser cannot recognise are not masked; the UI says so.
* **Transparency**: every question has a *What was sent* disclosure showing the exact context and options.
* **Context chips** (each removable): page/filters/selected item, selected text excerpt, open note. **TLP:RED notes are never sent.**
* **Conversation tools**: Cancel a pending request (late answers are ignored), Retry, Regenerate, Copy, **Save to Notebook** (stored inside a labelled "AI draft" block with the question), `/` saved prompts in the composer.
* **Window**: drag, resize, double-click header to expand, dock left/right, reset, bring-to-front, Alt+arrows to move and Alt+Shift+arrows to resize (keyboard alternative to dragging).

## Security Notebook
* **Editor**: headings, bold/italic/underline/strike/highlight, lists, **task lists**, quotes, code blocks, **tables** with row/column tools, links (http/https/mailto only), dividers, undo/redo, counts.
* **`/` menu and Insert menu**: Evidence, Timeline (UTC), IOC, ATT&CK mapping, Chain of custody, Response log tables; Observation / Hypothesis / Finding / Action / Warning callouts; Triage, Containment, Closure checklists; UTC timestamp.
* **Templates** (11): Security investigation, Alert triage, Credential attack review, Privilege escalation / AD change, Lateral movement, Incident summary, Post-incident report, Host, User, Shift handover, Detection tuning.
* **Reference drawer**: 27 Windows/AD event IDs with why they matter, 36 ATT&CK techniques (links to attack.mitre.org), logon types, TLP 2.0 levels, checklists. Insert or copy in one click. It is orientation, not authority; verify against MITRE and Microsoft docs.
* **IOC panel**: local extraction of IPv4, hashes (MD5/SHA-1/SHA-256), URLs, emails, CVEs, ATT&CK IDs, SIDs and event IDs; defang toggle; add to the note's IOC table; copy all; CSV (formula-injection safe).
* **Organisation**: title, TLP, status, case/alert ID, tags, pin, search across body text and tags, TLP filter, duplicate, **Recently deleted with Undo**, **version history** (automatic snapshots before AI replacement/restores/long sessions), JSON backup export/import (sanitised).
* **Notebook AI** (Notion-style): selection bubble and **AI** menu with Improve, Concise, Fix grammar, Explain, Summarize, Extract action items, Build UTC timeline, Executive summary, Next steps, and free-form Ask AI. Results appear in a review card; nothing is applied until the analyst chooses **Replace selection** (with an automatic snapshot) or **Insert below** (as a labelled AI block). Selection tasks send only the selected text; note tasks send a capped excerpt.
* **Sharing**: TLP-aware dialog shows classification and detected indicator counts, offers defanging, requires confirmation for AMBER and above, and disables copy/share for TLP:RED (download only). Exports (MD/TXT/HTML/CSV/print) carry a TLP banner.
* **Storage**: keeps the existing `cyberdna-security-notebook-v1` key and HTML format; existing notes load unchanged and gain default metadata.

## Click flexibility
* **Alt+A / Alt+N** toggle the AI Analyst and Notebook from anywhere.
* **Selection toolbar** (any page text or AI answer): Ask AI, Add to Notebook, Add as IOC (for a single IP/hash/URL/email), Copy. Switchable in AI settings; keyboard route through the palette.
* **Context menu**: Explain with AI, Open in AI Analyst, Add evidence to Notebook (formatted table), Add IP to IOC table, Open page, Copy identifier, Copy summary as JSON, each with a one-key accelerator; flips to stay on screen.
* **Reaching the menu without a mouse or right-click**: Menu key / Shift+F10 on a focused control inside a row, and long-press on touch devices (including iOS, which never fires `contextmenu`). The visible "..." button remains.
* **Command palette**: grouped (Ask, Actions, Navigate, Notes, Records), shortcut hints, open any note by title, create a note from any template, "Ask AI: ..." for any typed question, settings and IOC extraction commands.
* **Windows**: focus-to-front, dock, maximize, keyboard move/resize.

## Backend contract (still PROPOSED, unchanged status)
No explanation or chat endpoint exists in this repository, so the AI features call a proposed endpoint and show a clear "not available on this backend" message until it exists. Nothing returns fabricated answers.
```
POST /api/v1/assistant/chat
{ "message": "...", "history": [{ "role", "content" }],
  "context": { "page", "search?", "filters?", "selection?",
               "excerpt?": { "text", "from" }, "note?": { "title", "tlp", "text" } },
  "options": { "responseStyle": "concise|balanced|detailed", "audience": "analyst|executive", "redacted": false } }
-> { "reply": "...", "sections?": { "summary", "evidence": [str | {text, kind}], "risk", "next_steps": [str] } }
```
New since the last version: `context.excerpt`, `context.note`, `options`. When `options.redacted` is true, `IP-n`, `USER-n`, `HOST-n` are opaque placeholders. The backend must treat every field as untrusted, enforce auth and tenant scope, never invent IDs/users/IPs/timestamps, and never execute remediation.

## Verification (real results)
* `npm test`: **83 tests, 6 files, all passing** (core libraries 18, notebook UI 24, AI 11 + 13, interactions 16, app integration 1).
* `npm run build`: passes. Main bundle 353 KB (109 KB gzip); the editor is a separate lazy chunk (547 KB, 173 KB gzip) loaded only when the notebook first opens.
* **Real headless Chromium run against the built app** with real keystrokes and mouse events, zero console or page errors. It found and fixed bugs that jsdom tests could not:
  1. Pressing `/` inside the notebook jumped to the dashboard search (global shortcut ignored rich-text editors). Fixed with one guard in `Header.jsx`.
  2. A window position saved on a larger screen restored off-screen on a phone, hiding both windows. Fixed in `useFloatingWindow` (clamped on load; phones get a full-width sheet; the desktop position is not overwritten). Regression tests added.
  3. TLP/status selects stretched full width, drawer tabs were clipped, header subtitle wrapped. Fixed.
* Screenshots of the verified UI are in `docs/screenshots/`.

## Honest limits
* The AI backend does not exist yet; AI results in the screenshots used a stubbed response.
* Notes and settings live in browser storage (about 5 MB, with a usage meter and backup/import). Clearing site data deletes them. Server-side sync was not built.
* Masking only recognises identifiers present in the context and IPv4 patterns.
* Reference data (event IDs, ATT&CK) is a curated subset; verify against primary sources.
* Not tested: Safari/Firefox, real touch hardware (long-press was tested with simulated pointer events), screen readers, dark/high-contrast themes visually.
* On narrow screens, IOC table headers wrap tightly. The two launchers can pass over a row's "..." button while scrolling.
