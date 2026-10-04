export const mockIncidents = [
  {
    id: "INC-2026-01",
    title: "Domain Admin privilege escalation",
    severity: "Critical",
    risk_score: 95,
    status: "OPEN",
    users: 2,
    hosts: 2,
    first_seen: "13:45",
    last_seen: "14:08",
    attack_chain: [
      "Password spray",
      "Successful logon",
      "Privilege change"
    ]
  },
  {
    id: "INC-2026-02",
    title: "Abnormal Kerberos ticket activity",
    severity: "High",
    risk_score: 78,
    status: "INVESTIGATING",
    users: 1,
    hosts: 3,
    first_seen: "11:20",
    last_seen: "13:10",
    attack_chain: [
      "Unusual ticket volume",
      "Sensitive host access"
    ]
  },
  {
    id: "INC-2026-03",
    title: "Off-hours lateral movement",
    severity: "Medium",
    risk_score: 58,
    status: "OPEN",
    users: 1,
    hosts: 4,
    first_seen: "02:15",
    last_seen: "03:00",
    attack_chain: [
      "Off-hours logon",
      "SMB activity",
      "Multiple hosts"
    ]
  }
];
