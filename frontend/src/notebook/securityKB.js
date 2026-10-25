// Static analyst reference. This is orientation, not authority: matrices and event semantics change between
// versions, so the UI tells analysts to verify against MITRE ATT&CK and Microsoft documentation.
export const TLP = [
  { id: 'CLEAR', label: 'TLP:CLEAR', hint: 'Disclosure is not limited.', restricted: false },
  { id: 'GREEN', label: 'TLP:GREEN', hint: 'Limited to the community; not for public channels.', restricted: false },
  { id: 'AMBER', label: 'TLP:AMBER', hint: 'Limited to your organization and clients, on a need-to-know basis.', restricted: true },
  { id: 'AMBER+STRICT', label: 'TLP:AMBER+STRICT', hint: 'Limited to your organization only.', restricted: true },
  { id: 'RED', label: 'TLP:RED', hint: 'Named recipients only. Do not forward.', restricted: true },
];
export const tlpOf = (id) => TLP.find((t) => t.id === id) || TLP[2];
export const STATUSES = [['draft', 'Draft'], ['in-review', 'In review'], ['escalated', 'Escalated'], ['final', 'Final']];

export const EVENT_IDS = [
  { id: '4624', name: 'Successful logon', log: 'Security', why: 'Baseline for who logged on where. Check logon type, source IP and account.', attack: ['T1078'] },
  { id: '4625', name: 'Failed logon', log: 'Security', why: 'Bursts across many accounts suggest password spraying; many on one account suggests guessing.', attack: ['T1110'] },
  { id: '4634', name: 'Account logoff', log: 'Security', why: 'Use with 4624 to bound session length.', attack: [] },
  { id: '4648', name: 'Logon with explicit credentials', log: 'Security', why: 'Used by runas and some lateral movement tooling. Review the target server and process.', attack: ['T1078'] },
  { id: '4662', name: 'Operation performed on a directory object', log: 'Security', why: 'Replication-rights access by a non-DC account is a DCSync indicator.', attack: ['T1003.006'] },
  { id: '4672', name: 'Special privileges assigned to new logon', log: 'Security', why: 'Privileged logon. Unexpected for ordinary accounts.', attack: ['T1078'] },
  { id: '4688', name: 'New process created', log: 'Security', why: 'Needs process-creation auditing enabled. Review the command line where logged.', attack: ['T1059'] },
  { id: '4697', name: 'Service installed on the system', log: 'Security', why: 'New services can be persistence or remote execution.', attack: ['T1543.003'] },
  { id: '4698', name: 'Scheduled task created', log: 'Security', why: 'Common persistence and lateral movement mechanism.', attack: ['T1053.005'] },
  { id: '4719', name: 'System audit policy changed', log: 'Security', why: 'Weakening auditing can hide later activity.', attack: ['T1562'] },
  { id: '4720', name: 'User account created', log: 'Security', why: 'Verify there is a change ticket for new accounts, especially privileged ones.', attack: ['T1136'] },
  { id: '4722', name: 'User account enabled', log: 'Security', why: 'Dormant accounts being re-enabled deserve a second look.', attack: ['T1098'] },
  { id: '4724', name: 'Password reset attempt', log: 'Security', why: 'Check who reset whose password.', attack: ['T1098'] },
  { id: '4725', name: 'User account disabled', log: 'Security', why: 'Confirms containment actions or flags unexpected disabling.', attack: [] },
  { id: '4728', name: 'Member added to security-enabled global group', log: 'Security', why: 'Additions to Domain Admins or similar are high impact. Confirm who and why.', attack: ['T1098'] },
  { id: '4732', name: 'Member added to security-enabled local group', log: 'Security', why: 'Local Administrators additions grant host-level control.', attack: ['T1098'] },
  { id: '4738', name: 'User account changed', log: 'Security', why: 'Review changed attributes (flags, SPN, logon hours).', attack: ['T1098'] },
  { id: '4740', name: 'User account locked out', log: 'Security', why: 'Lockouts often follow guessing or spraying. Find the source host.', attack: ['T1110'] },
  { id: '4756', name: 'Member added to security-enabled universal group', log: 'Security', why: 'Universal group changes replicate forest-wide.', attack: ['T1098'] },
  { id: '4768', name: 'Kerberos authentication ticket (TGT) requested', log: 'Security', why: 'Accounts without pre-authentication can be targeted for AS-REP roasting.', attack: ['T1558.004'] },
  { id: '4769', name: 'Kerberos service ticket requested', log: 'Security', why: 'Many service-ticket requests with weak encryption can indicate Kerberoasting.', attack: ['T1558.003'] },
  { id: '4771', name: 'Kerberos pre-authentication failed', log: 'Security', why: 'Failed Kerberos logons. Compare with 4625 and 4776.', attack: ['T1110'] },
  { id: '4776', name: 'Domain controller validated credentials (NTLM)', log: 'Security', why: 'NTLM authentication attempts, including failures.', attack: ['T1110'] },
  { id: '5136', name: 'Directory service object modified', log: 'Security', why: 'Changes to AD objects such as GPOs or group membership attributes.', attack: ['T1484'] },
  { id: '1102', name: 'Audit log cleared', log: 'Security', why: 'Clearing the Security log is a strong defense-evasion signal.', attack: ['T1070.001'] },
  { id: '7045', name: 'New service installed', log: 'System', why: 'Review the service binary path and account.', attack: ['T1543.003'] },
];

export const LOGON_TYPES = [
  ['2', 'Interactive', 'Console logon at the keyboard.'], ['3', 'Network', 'SMB, mapped drives, many remote tools.'], ['4', 'Batch', 'Scheduled tasks.'],
  ['5', 'Service', 'Service started by the service control manager.'], ['7', 'Unlock', 'Workstation unlocked.'], ['8', 'NetworkCleartext', 'Credentials sent in cleartext on the network.'],
  ['9', 'NewCredentials', 'RunAs /netonly style logon with alternate credentials.'], ['10', 'RemoteInteractive', 'Remote Desktop / Terminal Services.'], ['11', 'CachedInteractive', 'Logon using cached domain credentials.'],
];

export const TECHNIQUES = [
  ['T1110', 'Brute Force', 'Credential Access'], ['T1110.001', 'Password Guessing', 'Credential Access'], ['T1110.003', 'Password Spraying', 'Credential Access'],
  ['T1078', 'Valid Accounts', 'Initial Access / Persistence / Privilege Escalation / Defense Evasion'],
  ['T1003', 'OS Credential Dumping', 'Credential Access'], ['T1003.001', 'LSASS Memory', 'Credential Access'], ['T1003.006', 'DCSync', 'Credential Access'],
  ['T1558', 'Steal or Forge Kerberos Tickets', 'Credential Access'], ['T1558.001', 'Golden Ticket', 'Credential Access'], ['T1558.002', 'Silver Ticket', 'Credential Access'],
  ['T1558.003', 'Kerberoasting', 'Credential Access'], ['T1558.004', 'AS-REP Roasting', 'Credential Access'],
  ['T1550.002', 'Pass the Hash', 'Defense Evasion / Lateral Movement'], ['T1550.003', 'Pass the Ticket', 'Defense Evasion / Lateral Movement'],
  ['T1021', 'Remote Services', 'Lateral Movement'], ['T1021.001', 'Remote Desktop Protocol', 'Lateral Movement'], ['T1021.002', 'SMB/Windows Admin Shares', 'Lateral Movement'], ['T1021.006', 'Windows Remote Management', 'Lateral Movement'],
  ['T1098', 'Account Manipulation', 'Persistence / Privilege Escalation'], ['T1136', 'Create Account', 'Persistence'],
  ['T1087', 'Account Discovery', 'Discovery'], ['T1069', 'Permission Groups Discovery', 'Discovery'], ['T1482', 'Domain Trust Discovery', 'Discovery'],
  ['T1484', 'Domain or Tenant Policy Modification', 'Defense Evasion / Privilege Escalation'], ['T1207', 'Rogue Domain Controller', 'Defense Evasion'],
  ['T1556', 'Modify Authentication Process', 'Credential Access / Defense Evasion / Persistence'], ['T1649', 'Steal or Forge Authentication Certificates', 'Credential Access'],
  ['T1070.001', 'Clear Windows Event Logs', 'Defense Evasion'], ['T1562', 'Impair Defenses', 'Defense Evasion'],
  ['T1053.005', 'Scheduled Task', 'Execution / Persistence / Privilege Escalation'], ['T1543.003', 'Windows Service', 'Persistence / Privilege Escalation'], ['T1059', 'Command and Scripting Interpreter', 'Execution'], ['T1059.001', 'PowerShell', 'Execution'],
].map(([id, name, tactic]) => ({ id, name, tactic }));
export const techniqueUrl = (id) => `https://attack.mitre.org/techniques/${String(id).replace('.', '/')}/`;
export const techniqueById = (id) => TECHNIQUES.find((t) => t.id === id);

export const IOC_TYPES = [['ipv4', 'IPv4 address'], ['domain', 'Domain'], ['url', 'URL'], ['hash', 'File hash'], ['email', 'Email'], ['account', 'Account'], ['host', 'Host'], ['other', 'Other']];

export const CHECKLISTS = {
  triage: { title: 'Triage checklist', items: ['Confirm the alert is not a known false positive or tuning gap', 'Record the alert ID, rule and timestamp (UTC)', 'Identify affected user, host and source IP', 'Check the user\'s recent baseline behavior', 'Look for related alerts on the same user or host', 'Decide: close as benign, keep monitoring, or escalate'] },
  containment: { title: 'Containment checklist (recommendations, not automated)', items: ['Agree the containment action with the incident lead before acting', 'Prefer EDR network isolation over powering off, to preserve volatile evidence', 'Preserve evidence and note who collected it, when and how (chain of custody)', 'Reset credentials only after scoping which accounts are exposed', 'Record every action taken with owner and UTC time'] },
  closure: { title: 'Closure checklist', items: ['Root cause identified or documented as unknown', 'Scope of affected users, hosts and data confirmed', 'Indicators exported to the detection team', 'ATT&CK techniques mapped with evidence references', 'Detection gaps and tuning actions logged', 'Lessons learned scheduled'] },
};
