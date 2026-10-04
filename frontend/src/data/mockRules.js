export const mockRules = [
  {
    name: "Brute Force Detection",
    category: "Authentication",
    severity: "High",
    condition: "Failures > 10 in 60s from one source",
    enabled: true,
    matches: 14
  },
  {
    name: "Password Spraying",
    category: "Authentication",
    severity: "Critical",
    condition: "Failures across > 5 accounts from one IP",
    enabled: true,
    matches: 8
  },
  {
    name: "Unusual Logon Time",
    category: "Behavioral Baseline",
    severity: "Medium",
    condition: "Outside learned activity window",
    enabled: true,
    matches: 22
  },
  {
    name: "New Account Creation",
    category: "Active Directory",
    severity: "Low",
    condition: "4720 outside change window",
    enabled: false,
    matches: 5
  },
  {
    name: "Privilege Escalation",
    category: "Active Directory",
    severity: "Critical",
    condition: "Privileged group membership change",
    enabled: true,
    matches: 3
  },
  {
    name: "Suspicious Kerberos",
    category: "Kerberos",
    severity: "High",
    condition: "Abnormal ticket request pattern",
    enabled: true,
    matches: 6
  }
];
