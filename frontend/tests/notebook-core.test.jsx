import { cleanHtml, htmlToText } from '../src/notebook/sanitize';
import { extractEntities, classifySingle, defang, refang } from '../src/notebook/entities';
import { htmlToMarkdown, exportNote, iocCsv } from '../src/notebook/exporters';
import { store, notebook, flush, normalizeNote, NOTES_KEY, MAX_VERSIONS } from '../src/notebook/notebookStore';
import { TEMPLATE_LIST } from '../src/notebook/templates';
import { SECURITY_BLOCKS, evidenceCard } from '../src/notebook/blocks';
import { techniqueUrl, EVENT_IDS, TECHNIQUES } from '../src/notebook/securityKB';

describe('sanitizer', () => {
  test('removes scripts, handlers, javascript: links, styles and unknown attributes', () => {
    const out = cleanHtml('<p onclick="x()" style="color:red">a<script>alert(1)</script><img src=x onerror=alert(2)></p><a href="javascript:alert(3)">l</a><a href="https://ok.example">ok</a><iframe src="//e"></iframe><div class="x">kept text</div>');
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|style=|iframe|<img|class=/i);
    expect(out).toContain('kept text');
    expect(out).toContain('href="https://ok.example"');
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });
  test('keeps callouts, task items and table spans but only for known values', () => {
    const out = cleanHtml('<div data-callout="hypothesis"><p>h</p></div><div data-callout="evil"><p>x</p></div><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>t</p></li></ul><table><tbody><tr><td colspan="2" onclick="x">c</td></tr></tbody></table>');
    expect(out).toContain('data-callout="hypothesis"');
    expect(out).not.toContain('evil');
    expect(out).toContain('data-checked="true"');
    expect(out).toContain('colspan="2"');
    expect(out).not.toContain('onclick');
  });
  test('legacy notes with <font> wrappers still load as plain structure', () => {
    expect(cleanHtml('<p><font size="5">Big</font></p>')).toBe('<p>Big</p>');
  });
});

describe('entities', () => {
  const text = 'Logon from 203.0.113.9 and 10.0.0.5, hash d41d8cd98f00b204e9800998ecf8427e, CVE-2024-12345, T1110.003, mail bad@evil.example, see https://evil.example/a.php, Event ID 4625, S-1-5-21-111-222-333-1001, again 203.0.113.9, 999.1.1.1';
  const found = extractEntities(text);
  const by = (t) => found.filter((e) => e.type === t);
  test('finds each indicator class, dedupes with counts, and rejects invalid IPs', () => {
    expect(by('ipv4').map((e) => [e.value, e.count, e.subtype])).toEqual([['203.0.113.9', 2, 'public'], ['10.0.0.5', 1, 'private']]);
    expect(by('hash')[0]).toMatchObject({ subtype: 'MD5' });
    expect(by('cve')[0].value).toBe('CVE-2024-12345');
    expect(by('technique')[0].value).toBe('T1110.003');
    expect(by('email')[0].value).toBe('bad@evil.example');
    expect(by('eventId')[0].value).toBe('4625');
    expect(by('sid')).toHaveLength(1);
    expect(found.some((e) => e.value.startsWith('999'))).toBe(false);
  });
  test('URL claims its host so it is not double counted', () => {
    expect(extractEntities('https://198.51.100.7/x').map((e) => e.type)).toEqual(['url']);
  });
  test('defang and refang round trip; single-selection classifier is strict', () => {
    expect(defang('http://evil.example/a', 'url')).toBe('hxxp://evil[.]example/a');
    expect(defang('203.0.113.9', 'ipv4')).toBe('203[.]0[.]113[.]9');
    expect(refang('hxxp://evil[.]example')).toBe('http://evil.example');
    expect(classifySingle('203.0.113.9')).toMatchObject({ type: 'ipv4' });
    expect(classifySingle('see 203.0.113.9 now')).toBeNull();
    expect(classifySingle('T1110')).toBeNull();
  });
});

describe('exporters', () => {
  const html = '<h2>Title</h2><p>Hello <strong>bold</strong> and <a href="https://a.example">link</a></p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li><li data-type="taskItem" data-checked="false"><p>todo</p></li></ul><ol><li>one</li><li>two</li></ol><table><tbody><tr><th>A</th><th>B|C</th></tr><tr><td>1</td><td>2</td></tr></tbody></table><div data-callout="hypothesis"><p>maybe</p></div><pre><code>net user</code></pre>';
  test('markdown covers headings, marks, tasks, lists, tables (escaped), callouts, code', () => {
    const md = htmlToMarkdown(html);
    expect(md).toContain('## Title');
    expect(md).toContain('**bold**');
    expect(md).toContain('[link](https://a.example)');
    expect(md).toContain('- [x] done');
    expect(md).toContain('- [ ] todo');
    expect(md).toContain('1. one');
    expect(md).toContain('| A | B\\|C |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('> **Hypothesis (unconfirmed):** maybe');
    expect(md).toContain('```\nnet user\n```');
  });
  test('exports include the TLP banner and can defang indicators', () => {
    const note = normalizeNote({ title: 'T', html: '<p>from 203.0.113.9</p>', tlp: 'RED', caseRef: 'INC-7', tags: ['ad'] });
    const md = exportNote(note, 'md', { defangIocs: true });
    expect(md.startsWith('TLP:RED | Case INC-7 | #ad')).toBe(true);
    expect(md).toContain('203[.]0[.]113[.]9');
    expect(exportNote(note, 'html')).toContain('class="tlp tlp-RED"');
    expect(exportNote(note, 'md', { banner: false }).startsWith('# T')).toBe(true);
  });
  test('IOC CSV neutralizes formula injection and defangs by default', () => {
    const csv = iocCsv([{ type: 'ipv4', value: '203.0.113.9', count: 1 }, { type: 'url', value: '=HYPERLINK("x")', count: 1 }]);
    expect(csv).toContain('203[.]0[.]113[.]9');
    expect(csv).toContain("\"'=HYPERLINK");
  });
});

describe('knowledge base and templates', () => {
  test('every template and block produces sanitizer-stable HTML', () => {
    TEMPLATE_LIST.forEach((t) => { const c = cleanHtml(t.html); expect(c.length).toBeGreaterThan(0); expect(cleanHtml(c)).toBe(c); });
    Object.values(SECURITY_BLOCKS).forEach((b) => { const c = cleanHtml(b.html()); expect(cleanHtml(c)).toBe(c); });
  });
  test('reference data is internally consistent', () => {
    const ids = new Set(TECHNIQUES.map((t) => t.id));
    EVENT_IDS.forEach((e) => e.attack.forEach((a) => expect(ids.has(a) || ids.has(a.split('.')[0])).toBe(true)));
    expect(techniqueUrl('T1110.003')).toBe('https://attack.mitre.org/techniques/T1110/003/');
    expect(techniqueUrl('T1078')).toBe('https://attack.mitre.org/techniques/T1078/');
  });
  test('evidence card lists only fields that exist and escapes values', () => {
    const c = cleanHtml(evidenceCard({ type: 'alert', id: 'ALT-1', user: '<b>x</b>', host: '' }));
    expect(c).toContain('ALT-1');
    expect(c).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(c).not.toContain('Host');
  });
});

describe('notebook store', () => {
  beforeEach(() => { localStorage.clear(); notebook.reload(); });
  test('migrates legacy notes (no metadata) without losing content', () => {
    localStorage.setItem(NOTES_KEY, JSON.stringify([{ id: 'old', title: 'Legacy', html: '<p>keep me</p><script>x</script>', updatedAt: 5 }]));
    notebook.reload();
    const n = store.get().notes[0];
    expect(n).toMatchObject({ id: 'old', title: 'Legacy', tags: [], status: 'draft', tlp: 'AMBER', pinned: false });
    expect(n.html).toBe('<p>keep me</p>');
  });
  test('create, update persists, delete goes to trash and can be restored', () => {
    const n = notebook.createNote('triage');
    notebook.updateNote(n.id, { title: 'Renamed' }); flush();
    expect(JSON.parse(localStorage.getItem(NOTES_KEY)).find((x) => x.id === n.id).title).toBe('Renamed');
    notebook.deleteNote(n.id);
    expect(store.get().notes.some((x) => x.id === n.id)).toBe(false);
    expect(store.get().trash[0].id).toBe(n.id);
    notebook.restoreNote(n.id);
    expect(store.get().notes[0].id).toBe(n.id);
    expect(store.get().trash).toHaveLength(0);
  });
  test('deleting the last note leaves a fresh note instead of an empty notebook', () => {
    store.get().notes.forEach((n) => notebook.deleteNote(n.id));
    expect(store.get().notes).toHaveLength(1);
  });
  test('snapshots are capped and restore keeps a safety copy', () => {
    const id = store.get().activeId;
    for (let i = 0; i < MAX_VERSIONS + 4; i += 1) notebook.snapshot(id, `s${i}`);
    expect(store.get().notes[0].versions).toHaveLength(MAX_VERSIONS);
    notebook.setHtml('<p>changed</p>');
    const v = store.get().notes[0].versions[0];
    notebook.restoreVersion(id, v.id);
    expect(store.get().notes[0].versions[0].label).toBe('Before restore');
    expect(store.get().notes[0].versions[0].html).toBe('<p>changed</p>');
  });
  test('appendHtml sanitizes and addIoc fills the empty IOC row, then appends rows', () => {
    notebook.appendHtml('<p>x</p><script>bad()</script>', { open: false });
    expect(store.get().notes[0].html).not.toContain('script');
    notebook.setHtml(SECURITY_BLOCKS.ioc.html());
    notebook.addIoc({ type: 'ipv4', value: '203.0.113.9', context: 'source of failures' });
    notebook.addIoc({ type: 'hash', value: 'a'.repeat(32) });
    notebook.addIoc({ type: 'url', value: 'http://e.example' });
    const text = htmlToText(store.get().notes[0].html);
    expect(text).toContain('203.0.113.9');
    expect(text).toContain('a'.repeat(32));
    expect(text).toContain('http://e.example');
    expect((store.get().notes[0].html.match(/<tr>/g) || []).length).toBe(4); // header + 2 original rows (one filled) + 1 appended
  });
  test('backup export/import round trips, sanitizes and re-ids collisions', () => {
    const before = store.get().notes.length;
    const json = notebook.exportBackup();
    expect(notebook.importBackup(json)).toBe(before);
    expect(new Set(store.get().notes.map((n) => n.id)).size).toBe(before * 2);
    expect(() => notebook.importBackup('nope')).toThrow(/not valid JSON/);
    expect(() => notebook.importBackup('{"notes":[]}')).toThrow(/No notes/);
    notebook.importBackup(JSON.stringify([{ title: 'evil', html: '<img src=x onerror=alert(1)><p>ok</p>', tlp: 'BOGUS', status: 'zzz' }]));
    const n = store.get().notes[0];
    expect(n.html).toBe('<p>ok</p>');
    expect(n).toMatchObject({ tlp: 'AMBER', status: 'draft' });
  });
});
