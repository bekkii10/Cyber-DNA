// Demo data used when the backend is unreachable. Shapes match api/adapters.js output.
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function activitySeries(range = '24h') {
  const r = rnd(range === '24h' ? 7 : range === '7d' ? 11 : 13);
  const now = new Date();
  const n = range === '24h' ? 24 : range === '7d' ? 7 : 30;
  const labels = [], events = [], alerts = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    if (range === '24h') { d.setHours(now.getHours() - i, 0, 0, 0); labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })); }
    else { d.setDate(now.getDate() - i); labels.push(range === '7d' ? d.toLocaleDateString([], { weekday: 'short' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })); }
    const hour = range === '24h' ? d.getHours() : 12;
    const daylight = hour >= 8 && hour <= 18 ? 1 : 0.45;
    const base = range === '24h' ? 1040 : range === '7d' ? 24800 : 24000;
    const v = Math.round(base * daylight * (0.7 + r() * 0.6));
    events.push(v);
    alerts.push(Math.max(0, Math.round(v * 0.0045 * (0.5 + r() * 1.4))));
  }
  return { labels, series: [{ key: 'events', label: 'Events', values: events }, { key: 'alerts', label: 'Alerts', values: alerts }] };
}

const shape = (start, end, base) => Array.from({ length: 24 }, (_, h) => (h >= start && h <= end ? Math.round(base * (0.55 + 0.45 * Math.sin(((h - start) / (end - start + 1)) * Math.PI))) : h === start - 1 || h === end + 1 ? 1 : 0));
const spike = (arr, add) => arr.map((v, h) => v + (add[h] || 0));

export const alerts = [
  { id: 'ALT-2043', severity: 'critical', title: 'Multiple failed logons followed by success', eventId: 4625, user: 'sifen.melaku', ip: '192.168.56.101', host: 'LAB-WS-099', ts: ago(2), status: 'New', rule: 'Brute force — failed logons', description: '14 failed logons (4625) within 4 minutes, followed by a successful logon (4624) from an unmanaged workstation.' },
  { id: 'ALT-2042', severity: 'high', title: 'Special privileges assigned to new logon', eventId: 4672, user: 'abebe.kassa', ip: '10.0.2.15', host: 'IT-WS-007', ts: ago(12), status: 'Investigating', rule: 'Privileged logon outside baseline', description: 'Administrator-level privileges assigned to a session that is outside this account’s normal behavior.' },
  { id: 'ALT-2041', severity: 'high', title: 'Account added to privileged group', eventId: 4728, user: 'svc_backup', ip: '10.0.2.44', host: 'DC01', ts: ago(21), status: 'New', rule: 'Privileged group membership change', description: 'A service account was added to Domain Admins by a non-standard administrator workstation.' },
  { id: 'ALT-2040', severity: 'medium', title: 'Logon from unusual source address', eventId: 4624, user: 'yordanos.tsegay', ip: '172.16.10.23', host: 'FIN-WS-021', ts: ago(32), status: 'Acknowledged', rule: 'New source IP for user', description: 'Interactive logon from a source IP never observed for this user in the 30-day baseline.' },
  { id: 'ALT-2039', severity: 'medium', title: 'Kerberos service ticket with weak encryption', eventId: 4769, user: 'getachew.gebre', ip: '10.0.2.52', host: 'SQL01', ts: ago(47), status: 'New', rule: 'Kerberoasting indicator', description: 'Multiple service ticket requests using RC4 encryption in a short interval.' },
  { id: 'ALT-2038', severity: 'low', title: 'Outbound connection permitted to unusual port', eventId: 5156, user: '—', ip: '10.0.2.18', host: 'FS01', ts: ago(118), status: 'Acknowledged', rule: 'Network anomaly', description: 'Windows Filtering Platform permitted an outbound connection on an uncommon port.' },
  { id: 'ALT-2037', severity: 'info', title: 'User account created', eventId: 4720, user: 'dawit.alemu', ip: '192.168.56.101', host: 'DC01', ts: ago(190), status: 'Resolved', rule: 'Account lifecycle', description: 'New domain account created by an approved administrator.' },
  { id: 'ALT-2036', severity: 'critical', title: 'Security audit log cleared', eventId: 1102, user: 'abebe.kassa', ip: '10.0.2.15', host: 'IT-WS-007', ts: ago(260), status: 'Resolved', rule: 'Defense evasion — log cleared', description: 'The Security event log was cleared. Confirmed as a scheduled maintenance task.' },
];

export const incidents = [
  { id: 'INC-0043', title: 'Credential compromise on HR workstation', severity: 'critical', status: 'Open', users: ['sifen.melaku'], hosts: ['LAB-WS-099', 'HR-WS-014'], ts: ago(120), summary: 'Correlated brute-force attempts and an off-hours logon from an unmanaged host using the HR account.', timeline: [{ t: ago(124), text: '14 failed logons (4625) from 192.168.56.101' }, { t: ago(121), text: 'Successful logon (4624) as sifen.melaku on LAB-WS-099' }, { t: ago(119), text: 'Special privileges assigned (4672) to the new session' }, { t: ago(2), text: 'Alert ALT-2043 raised and grouped into this incident' }], events: [{ id: 'EVT-88201', eventId: 4625, desc: 'Failed logon — bad password', ts: ago(124) }, { id: 'EVT-88214', eventId: 4624, desc: 'Successful network logon', ts: ago(121) }, { id: 'EVT-88219', eventId: 4672, desc: 'Special privileges assigned', ts: ago(119) }] },
  { id: 'INC-0042', title: 'Privilege escalation from IT workstation', severity: 'high', status: 'Investigating', users: ['abebe.kassa', 'svc_backup'], hosts: ['IT-WS-007', 'DC01'], ts: ago(240), summary: 'A privileged logon followed by a service account being added to Domain Admins.', timeline: [{ t: ago(250), text: 'Privileged logon (4672) outside normal hours' }, { t: ago(244), text: 'Account svc_backup added to Domain Admins (4728)' }, { t: ago(240), text: 'Incident opened by correlation engine' }], events: [{ id: 'EVT-87655', eventId: 4672, desc: 'Special privileges assigned', ts: ago(250) }, { id: 'EVT-87662', eventId: 4728, desc: 'Member added to security-enabled global group', ts: ago(244) }] },
  { id: 'INC-0041', title: 'Unmanaged device joined to domain', severity: 'medium', status: 'Open', users: ['dawit.alemu'], hosts: ['LAB-WS-099'], ts: ago(360), summary: 'A device not in the asset inventory authenticated to the domain shortly after an account was created.', timeline: [{ t: ago(372), text: 'User account created (4720)' }, { t: ago(361), text: 'First logon from LAB-WS-099' }], events: [{ id: 'EVT-86902', eventId: 4720, desc: 'User account created', ts: ago(372) }] },
  { id: 'INC-0040', title: 'Possible data exfiltration from file server', severity: 'high', status: 'Resolved', users: ['getachew.gebre'], hosts: ['FS01'], ts: ago(540), summary: 'Large outbound transfer correlated with unusual share access. Confirmed as an approved backup job.', timeline: [{ t: ago(552), text: 'Unusual share enumeration' }, { t: ago(545), text: 'Large outbound transfer detected' }, { t: ago(500), text: 'Closed — approved backup job' }], events: [{ id: 'EVT-85100', eventId: 5156, desc: 'Connection permitted', ts: ago(545) }] },
  { id: 'INC-0039', title: 'Unusual administrative activity', severity: 'medium', status: 'Investigating', users: ['yordanos.tsegay'], hosts: ['FIN-WS-021'], ts: ago(720), summary: 'Finance user performed administrative actions not seen in the baseline.', timeline: [{ t: ago(730), text: 'New source IP for user (4624)' }, { t: ago(722), text: 'Administrative tool executed (4688)' }], events: [{ id: 'EVT-84120', eventId: 4688, desc: 'New process created', ts: ago(722) }] },
];

export const users = [
  { username: 'sifen.melaku', display: 'Sifen Melaku', dept: 'HR Department', risk: 92, anomaly: 0.94, trend: 'up', ts: ago(12), behavior: 'Credential misuse suspected', baseline: { hours: '08:00 – 17:30', computers: ['HR-WS-014'], ips: ['10.0.2.31'], loginsPerDay: 6 }, hourlyBaseline: shape(8, 17, 6), hourlyToday: spike(shape(8, 17, 5), { 2: 9, 3: 7 }), riskTrend: [22, 24, 23, 27, 30, 41, 58, 74, 92], knownComputers: [{ name: 'HR-WS-014', isNew: false }, { name: 'LAB-WS-099', isNew: true }], knownIps: [{ name: '10.0.2.31', isNew: false }, { name: '192.168.56.101', isNew: true }], anomalies: [{ ts: ago(124), text: '14 failed logons in 4 minutes', severity: 'critical' }, { ts: ago(121), text: 'First-ever logon from LAB-WS-099', severity: 'high' }, { ts: ago(119), text: 'Logon at 02:00, outside normal hours', severity: 'high' }], what: 'After 14 failed password attempts, the account signed in successfully from LAB-WS-099, a computer and IP address never used before, at 02:00.', means: 'The pattern matches password guessing followed by account takeover. It differs sharply from this user’s weekday office-hours behavior.', recommendation: 'Disable the session, force a password reset, and review activity on LAB-WS-099. Contact the user to confirm they were not signing in.' },
  { username: 'abebe.kassa', display: 'Abebe Kassa', dept: 'IT Department', risk: 78, anomaly: 0.81, trend: 'up', ts: ago(28), behavior: 'Privilege use outside baseline', baseline: { hours: '07:30 – 18:00', computers: ['IT-WS-007', 'DC01'], ips: ['10.0.2.15'], loginsPerDay: 11 }, hourlyBaseline: shape(7, 18, 8), hourlyToday: spike(shape(7, 18, 7), { 22: 6, 23: 5 }), riskTrend: [35, 36, 40, 38, 44, 52, 60, 70, 78], knownComputers: [{ name: 'IT-WS-007', isNew: false }, { name: 'DC01', isNew: false }, { name: 'FS01', isNew: true }], knownIps: [{ name: '10.0.2.15', isNew: false }], anomalies: [{ ts: ago(250), text: 'Privileged logon at 22:00', severity: 'high' }, { ts: ago(244), text: 'Added svc_backup to Domain Admins', severity: 'high' }], what: 'Administrative privileges were used late in the evening and a service account was added to Domain Admins.', means: 'Admins often work late, but this group change was not tied to a known change window and is unusual for this account.', recommendation: 'Verify the change with the IT lead. If not approved, remove the membership and rotate svc_backup credentials.' },
  { username: 'yordanos.tsegay', display: 'Yordanos Tsegay', dept: 'Finance', risk: 65, anomaly: 0.66, trend: 'flat', ts: ago(60), behavior: 'New source location', baseline: { hours: '08:30 – 17:00', computers: ['FIN-WS-021'], ips: ['10.0.3.21'], loginsPerDay: 5 }, hourlyBaseline: shape(8, 16, 5), hourlyToday: spike(shape(8, 16, 4), { 19: 3 }), riskTrend: [40, 42, 41, 44, 48, 52, 58, 62, 65], knownComputers: [{ name: 'FIN-WS-021', isNew: false }], knownIps: [{ name: '10.0.3.21', isNew: false }, { name: '172.16.10.23', isNew: true }], anomalies: [{ ts: ago(32), text: 'Logon from new IP 172.16.10.23', severity: 'medium' }, { ts: ago(722), text: 'Administrative tool executed', severity: 'medium' }], what: 'The user signed in from an IP address not seen in the last 30 days and launched an administrative tool.', means: 'Could be remote work or VPN, but the tool usage is unusual for a finance role.', recommendation: 'Confirm the location with the user and review the process execution on FIN-WS-021.' },
  { username: 'svc_backup', display: 'svc_backup (service)', dept: 'Service account', risk: 58, anomaly: 0.7, trend: 'up', ts: ago(21), behavior: 'Service account behavior change', baseline: { hours: '01:00 – 03:00', computers: ['FS01', 'DC01'], ips: ['10.0.2.44'], loginsPerDay: 4 }, hourlyBaseline: shape(1, 3, 4), hourlyToday: spike(shape(1, 3, 4), { 14: 5 }), riskTrend: [12, 12, 14, 13, 15, 18, 30, 46, 58], knownComputers: [{ name: 'FS01', isNew: false }, { name: 'DC01', isNew: false }], knownIps: [{ name: '10.0.2.44', isNew: false }], anomalies: [{ ts: ago(244), text: 'Added to Domain Admins', severity: 'high' }, { ts: ago(30), text: 'Interactive activity at 14:00', severity: 'medium' }], what: 'A service account that normally runs at night became active during the day and gained privileged group membership.', means: 'Service accounts should not change behavior. This may indicate credential misuse.', recommendation: 'Rotate the credentials and restrict interactive logon for this account.' },
  { username: 'getachew.gebre', display: 'Getachew Gebre', dept: 'Sales', risk: 47, anomaly: 0.48, trend: 'down', ts: ago(120), behavior: 'Minor deviation', baseline: { hours: '08:00 – 17:30', computers: ['SAL-WS-003'], ips: ['10.0.4.12'], loginsPerDay: 5 }, hourlyBaseline: shape(8, 17, 5), hourlyToday: shape(8, 17, 5), riskTrend: [60, 58, 55, 54, 52, 50, 49, 48, 47], knownComputers: [{ name: 'SAL-WS-003', isNew: false }, { name: 'SQL01', isNew: true }], knownIps: [{ name: '10.0.4.12', isNew: false }], anomalies: [{ ts: ago(47), text: 'Service tickets with RC4 encryption', severity: 'medium' }], what: 'Several Kerberos service tickets were requested using weak encryption.', means: 'Often caused by legacy software, but it can also indicate Kerberoasting.', recommendation: 'Check the application on SQL01 and enforce AES for service accounts.' },
  { username: 'hana.bekele', display: 'Hana Bekele', dept: 'Legal', risk: 31, anomaly: 0.28, trend: 'flat', ts: ago(35), behavior: 'Normal behavior', baseline: { hours: '09:00 – 17:00', computers: ['LEG-WS-002'], ips: ['10.0.5.8'], loginsPerDay: 4 }, hourlyBaseline: shape(9, 16, 4), hourlyToday: shape(9, 16, 4), riskTrend: [30, 31, 29, 32, 31, 30, 32, 31, 31], knownComputers: [{ name: 'LEG-WS-002', isNew: false }], knownIps: [{ name: '10.0.5.8', isNew: false }], anomalies: [], what: 'No unusual activity in the last 24 hours.', means: 'Behavior matches the established baseline.', recommendation: 'No action required.' },
  { username: 'dawit.alemu', display: 'Dawit Alemu', dept: 'Engineering', risk: 24, anomaly: 0.22, trend: 'down', ts: ago(15), behavior: 'Normal behavior', baseline: { hours: '09:30 – 19:00', computers: ['ENG-WS-011'], ips: ['10.0.6.40'], loginsPerDay: 7 }, hourlyBaseline: shape(9, 18, 7), hourlyToday: shape(9, 18, 7), riskTrend: [28, 27, 27, 26, 25, 25, 24, 24, 24], knownComputers: [{ name: 'ENG-WS-011', isNew: false }], knownIps: [{ name: '10.0.6.40', isNew: false }], anomalies: [], what: 'No unusual activity in the last 24 hours.', means: 'Behavior matches the established baseline.', recommendation: 'No action required.' },
];

export const hosts = [
  { hostname: 'DC01', ip: '10.0.2.5', os: 'Windows Server 2022', status: 'Online', ts: ago(1), risk: 22, events: 8410, role: 'Domain controller' },
  { hostname: 'DC02', ip: '10.0.2.6', os: 'Windows Server 2022', status: 'Online', ts: ago(1), risk: 18, events: 6120, role: 'Domain controller' },
  { hostname: 'FS01', ip: '10.0.2.18', os: 'Windows Server 2019', status: 'Online', ts: ago(3), risk: 41, events: 3290, role: 'File server' },
  { hostname: 'SQL01', ip: '10.0.2.52', os: 'Windows Server 2019', status: 'Online', ts: ago(2), risk: 52, events: 2740, role: 'Database server' },
  { hostname: 'HR-WS-014', ip: '10.0.2.31', os: 'Windows 11 Pro', status: 'Online', ts: ago(12), risk: 70, events: 1180, role: 'Workstation' },
  { hostname: 'IT-WS-007', ip: '10.0.2.15', os: 'Windows 11 Pro', status: 'Online', ts: ago(5), risk: 61, events: 1960, role: 'Workstation' },
  { hostname: 'FIN-WS-021', ip: '10.0.3.21', os: 'Windows 10 Enterprise', status: 'Idle', ts: ago(95), risk: 44, events: 640, role: 'Workstation' },
  { hostname: 'LAB-WS-099', ip: '192.168.56.101', os: 'Windows 10 Pro', status: 'Online', ts: ago(2), risk: 91, events: 352, role: 'Unmanaged workstation' },
  { hostname: 'LEG-WS-002', ip: '10.0.5.8', os: 'Windows 11 Pro', status: 'Offline', ts: ago(1560), risk: 12, events: 210, role: 'Workstation' },
];

export const rules = [
  { id: 'R-001', name: 'Multiple failed logons', eventId: 4625, severity: 'critical', enabled: true, hits: 41, mitre: 'T1110', description: 'Detects bursts of failed logons for one account.' },
  { id: 'R-002', name: 'Privileged logon outside baseline', eventId: 4672, severity: 'high', enabled: true, hits: 18, mitre: 'T1078', description: 'Special privileges assigned to an unusual session.' },
  { id: 'R-003', name: 'Privileged group membership change', eventId: 4728, severity: 'high', enabled: true, hits: 3, mitre: 'T1098', description: 'Member added to a privileged security group.' },
  { id: 'R-004', name: 'New source IP for user', eventId: 4624, severity: 'medium', enabled: true, hits: 27, mitre: 'T1078', description: 'Logon from an address not seen in the baseline.' },
  { id: 'R-005', name: 'Kerberoasting indicator', eventId: 4769, severity: 'medium', enabled: true, hits: 6, mitre: 'T1558.003', description: 'Service tickets requested with weak encryption.' },
  { id: 'R-006', name: 'Audit log cleared', eventId: 1102, severity: 'critical', enabled: true, hits: 1, mitre: 'T1070.001', description: 'Security event log was cleared.' },
  { id: 'R-007', name: 'Account created', eventId: 4720, severity: 'info', enabled: true, hits: 5, mitre: 'T1136', description: 'New domain account created.' },
  { id: 'R-008', name: 'Suspicious process creation', eventId: 4688, severity: 'low', enabled: false, hits: 0, mitre: 'T1059', description: 'Administrative tools launched by non-admin roles.' },
];

export const overview = {
  totalEvents: 24892,
  eventsDelta: 12,
  distribution: [
    { label: 'Logon events', value: 10455 },
    { label: 'Process events', value: 4481 },
    { label: 'Network events', value: 3734 },
    { label: 'Account changes', value: 2489 },
    { label: 'Other', value: 3733 },
  ],
};

export const detection = { state: 'Running', rulesLoaded: 8, eventsProcessed: 24892, alertsGenerated: 7, lastRun: ago(0.1) };
export const correlation = { state: 'Running', windowMinutes: 15, openCases: 4, correlatedEvents: 312, lastRun: ago(0.2) };

export const model = {
  name: 'Cyber DNA Behavior Model',
  version: 'v1.0.0 (demo)',
  type: 'Unsupervised anomaly detection + rule-based risk scoring',
  trained: ago(60 * 24 * 3),
  features: ['Logon hour', 'Source host', 'Source IP', 'Failed logon ratio', 'Privilege use', 'Group changes'],
  baselineDays: 30,
  threshold: 0.75,
};

export const riskTrend = { labels: ['-8d', '-7d', '-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'Today'], values: [34, 35, 33, 38, 41, 44, 52, 58, 64] };

export const services = [
  { key: 'collector', name: 'Collector', icon: 'Radio', uptime: 99.8, detail: 'Last event 4s ago', trend: [4, 5, 4, 6, 5, 7, 6, 8, 7] },
  { key: 'api', name: 'API', icon: 'CloudCog', uptime: 99.9, detail: '/api/v1 · 38 ms avg', trend: [5, 5, 6, 5, 6, 5, 6, 6, 5] },
  { key: 'database', name: 'Database', icon: 'Database', uptime: 99.7, detail: '24,892 events today', trend: [3, 4, 4, 5, 6, 6, 7, 7, 8] },
  { key: 'detection', name: 'Detection engine', icon: 'ShieldCheck', uptime: 99.5, detail: '7 of 8 rules enabled', trend: [5, 6, 5, 7, 6, 6, 7, 6, 7] },
  { key: 'correlation', name: 'Correlation engine', icon: 'GitMerge', uptime: 99.2, detail: '15 min window', trend: [4, 4, 5, 5, 4, 6, 5, 6, 6] },
  { key: 'ml', name: 'ML engine', icon: 'BrainCircuit', uptime: 98.6, detail: 'Model v1.0.0 (demo)', trend: [6, 6, 5, 6, 7, 6, 7, 7, 7] },
];
