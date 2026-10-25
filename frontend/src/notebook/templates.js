import { callout, checklistHtml, tableHtml } from './blocks';

const h = (level, t) => `<h${level}>${t}</h${level}>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const p = (t = '') => `<p>${t}</p>`;
const sep = [callout('observation', 'Observations: what the data directly shows.'), callout('hypothesis', 'Hypotheses: explanations that still need testing.')].join('');

export const TEMPLATES = {
  investigation: { title: 'Security investigation', group: 'General', desc: 'Evidence, assessment and next steps',
    html: h(2, 'Investigation notes') + p('Record what you observed, what the evidence supports, and what still needs verification.') + h(3, 'Evidence') + ul(['Source event or record:', 'Timestamp (UTC):', 'Relevant user / host:']) + h(3, 'Assessment') + sep + h(3, 'Next steps') + ul(['']) },
  triage: { title: 'Alert triage', group: 'Analyst workflow', desc: 'Quick L1 triage with a disposition',
    html: h(1, 'Alert triage') + h(2, 'Alert') + ul(['Alert ID / rule:', 'Severity and risk score:', 'Time (UTC):', 'User / host / source IP:']) + h(2, 'Checks') + checklistHtml('triage') + h(2, 'Disposition') + p('Benign / Monitor / Escalate, and why:') + callout('finding') },
  credential: { title: 'Credential attack review', group: 'Active Directory', desc: 'Brute force, spraying, Kerberos abuse',
    html: h(1, 'Credential attack review') + h(2, 'Pattern') + ul(['Failed logons (4625 / 4771 / 4776): count, window, accounts targeted', 'One account many sources, or many accounts one source?', 'Lockouts (4740) and their source host', 'Any success (4624) after the failures? Logon type and source']) + h(2, 'Timeline (UTC)') + tableHtml(['Time (UTC)', 'Source', 'What happened', 'Evidence'], 3) + h(2, 'Assessment') + sep + h(2, 'ATT&CK mapping') + tableHtml(['Tactic', 'Technique', 'ID', 'Supporting evidence'], 1) + h(2, 'Next steps') + ul(['']) },
  privesc: { title: 'Privilege escalation / AD change', group: 'Active Directory', desc: 'Group membership and account changes',
    html: h(1, 'Privilege escalation / AD change review') + h(2, 'Change') + ul(['Group or account affected:', 'Event (4728 / 4732 / 4756 / 4720 / 4738):', 'Changed by (actor) and from where:', 'Time (UTC):']) + h(2, 'Legitimacy checks') + ul(['Change ticket or approval exists?', 'Actor normally performs this action?', 'Followed by privileged logons (4672) or new activity?']) + h(2, 'Assessment') + sep + callout('action', 'Recommended response (needs authorization): ') + h(2, 'Evidence') + tableHtml(['Source', 'Event ID', 'Time (UTC)', 'Detail'], 2) },
  lateral: { title: 'Lateral movement', group: 'Active Directory', desc: 'Remote logons, pass-the-hash/ticket indicators',
    html: h(1, 'Lateral movement review') + h(2, 'Hop map') + tableHtml(['Time (UTC)', 'From host', 'To host', 'Account', 'Logon type / method'], 3) + h(2, 'Indicators') + ul(['Network logons (type 3) and RDP (type 10) from unusual sources', 'Explicit credential use (4648)', 'Service or scheduled task creation on the target (4697 / 4698 / 7045)']) + h(2, 'Assessment') + sep + h(2, 'Containment options') + checklistHtml('containment') },
  incident: { title: 'Incident summary', group: 'Reporting', desc: 'Executive summary, scope, timeline, actions',
    html: h(1, 'Incident summary') + h(2, 'Executive summary') + p() + h(2, 'Scope and impact') + ul(['Affected users:', 'Affected hosts:', 'Business impact:', 'Data involved:']) + h(2, 'Timeline (UTC)') + tableHtml(['Time (UTC)', 'Source', 'What happened', 'Evidence'], 3) + h(2, 'Root cause') + p() + h(2, 'Actions taken') + tableHtml(['Action', 'Owner', 'Status', 'Time (UTC)'], 2) + h(2, 'Open questions and confidence') + p() },
  report: { title: 'Post-incident report', group: 'Reporting', desc: 'Full report with ATT&CK mapping and recommendations',
    html: h(1, 'Post-incident report') + h(2, 'Executive summary') + p() + h(2, 'Timeline (UTC)') + tableHtml(['Time (UTC)', 'Source', 'What happened', 'Evidence'], 4) + h(2, 'Affected scope') + ul(['Users:', 'Hosts:', 'Data:']) + h(2, 'Root cause') + p() + h(2, 'Attacker techniques (ATT&CK)') + tableHtml(['Tactic', 'Technique', 'ID', 'Supporting evidence'], 3) + h(2, 'Containment and eradication') + tableHtml(['Action', 'Owner', 'Status', 'Time (UTC)'], 3) + h(2, 'Dwell time') + p('First malicious activity to detection:') + h(2, 'Recommendations') + ul(['Detection gaps:', 'Process and runbook gaps:', 'Hardening:']) + h(2, 'Closure') + checklistHtml('closure') },
  host: { title: 'Host investigation', group: 'Entities', desc: 'Host details, activity and assessment',
    html: h(1, 'Host investigation') + h(2, 'Host details') + ul(['Hostname / IP:', 'Owner / department:', 'Last observed (UTC):']) + h(2, 'Observed activity') + p() + h(2, 'Relevant events and evidence') + tableHtml(['Source', 'Event ID', 'Time (UTC)', 'Detail'], 2) + h(2, 'Assessment') + sep + h(2, 'Recommended next steps') + ul(['']) },
  user: { title: 'User investigation', group: 'Entities', desc: 'Authentication, access changes and baseline',
    html: h(1, 'User investigation') + h(2, 'User details') + ul(['Username:', 'Department / role:', 'Privileged?']) + h(2, 'Authentication activity') + p() + h(2, 'Privilege and access changes') + p() + h(2, 'Compared with baseline') + ul(['Usual hours and hosts:', 'What is new or unusual:']) + h(2, 'Evidence') + tableHtml(['Source', 'Event ID', 'Time (UTC)', 'Detail'], 2) + h(2, 'Assessment') + sep + h(2, 'Next steps') + ul(['']) },
  handover: { title: 'Shift handover', group: 'Analyst workflow', desc: 'Open items for the next analyst',
    html: h(1, 'Shift handover') + p('Shift / analyst / time (UTC):') + h(2, 'Open investigations') + tableHtml(['Case / alert', 'Status', 'What is known', 'Next step'], 3) + h(2, 'Watch list') + ul(['']) + h(2, 'Things to know') + ul(['']) },
  tuning: { title: 'Detection tuning review', group: 'Analyst workflow', desc: 'False-positive analysis for a rule',
    html: h(1, 'Detection tuning review') + h(2, 'Rule') + ul(['Rule name / ID:', 'Event ID and logic:', 'Alerts reviewed (count, window):']) + h(2, 'Findings') + tableHtml(['Alert / case', 'True or false positive', 'Why', 'Tuning idea'], 3) + h(2, 'Proposed change') + p('Describe the change and the risk of missing real activity:') + callout('warning', 'Test any exclusion against known-bad samples before enabling it.') },
  blank: { title: 'Untitled note', group: 'General', desc: 'Empty note', html: '<p></p>' },
};
export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(([id, t]) => ({ id, ...t }));
export const templateById = (id) => TEMPLATES[id] || TEMPLATES.investigation;
