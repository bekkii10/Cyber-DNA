# Cyber DNA — floating AI Analyst and Security Notebook upgrade

## Implemented

- AI Analyst is now a movable floating panel. Drag its header to reposition it and drag the lower-right grip to resize it.
- Security Notebook is a separate movable and resizable panel. The two panels have independent saved positions and sizes.
- Both panels restore their position and size from browser local storage. Their launchers remain available while panels are open.
- Notebook supports multiple notes, browser-local autosave, note titles, a note browser, delete/new-note actions, and templates for security investigations, incident summaries, host investigations, user investigations, and blank notes.
- Editor toolbar includes headings, bold, italic, underline, bullet/numbered lists, text size, links, code blocks, evidence tables, divider, undo/redo, clear formatting, and quote formatting.
- Export/download options: Markdown, TXT, and formatted HTML. Print uses a focused print stylesheet so the analyst can choose “Save as PDF”.
- Share action displays a sensitive-data warning first. It then uses the browser's native share sheet when available or copies the note text for manual sharing.
- Context menus now include “Add context to Notebook”; the captured snapshot includes the loaded record fields, timestamp, and a reminder to verify against source events. The command palette can open the notebook.
- Note HTML is sanitized on load/save to avoid trusting arbitrary markup stored in browser storage.

## Data and API boundaries

- Notes and floating-window preferences are stored in this browser's local storage. They are not uploaded to the backend and are not automatically shared with teammates. Export a backup to move notes between browsers/devices.
- Context snapshots contain only the fields already available in the selected frontend record; they are not a substitute for raw source-event verification.
- Existing API client, assistant API wrapper, data provider, and adapter files were compared with the uploaded frontend and remain unchanged. No endpoint or request/response contract was added or modified in this update.
- The existing AI Analyst backend route remains unverified by this frontend-only package; this change does not claim a real Gemini/backend connection was tested.

## Verification

- TypeScript compiler syntax parse over all frontend `.js` / `.jsx` files: passed.
- Hash/content comparison for `src/api/client.js`, `src/api/assistant.js`, `src/data/DataContext.jsx`, and `src/api/adapters.js`: unchanged versus the uploaded frontend.
- Automated test file added for notebook autosave, templates, and contextual record capture.
- Production build and automated test suite: **not run successfully**. `npm ci` timed out, and offline installation failed because required package tarballs were not cached. Run `npm ci`, `npm test`, and `npm run build` on a machine with npm registry access before deployment.
