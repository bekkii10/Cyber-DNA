import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertTriangle, Shield, User, Server, Cpu, 
  Terminal, Search, Filter, RefreshCw, Eye, ChevronRight, 
  CheckCircle, XCircle, Zap, Lock, Database, Clock, Play, Pause, Layers
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

// --- MOCK DATA GENERATION & SEEDS ---
const INITIAL_STATS = {
  totalEvents: 67,
  activeAlerts: 20,
  openIncidents: 3,
  highRiskUsers: 3,
  highRiskHosts: 2
};

const SEVERITY_COLORS = {
  Critical: '#ff2d55',
  High: '#ff9f0a',
  Medium: '#00e5ff',
  Low: '#00ff9f'
};

const INITIAL_EVENTS = [
  { id: 'E-101', timestamp: '09/16, 14:02:53', eventId: '4728', user: 'admin', host: 'DC-PROD01', sourceIp: '203.45.78.12', status: 'SUCCESS', action: 'Member added to security group' },
  { id: 'E-102', timestamp: '09/16, 14:02:51', eventId: '4625', user: 'svc_backup', host: 'WS-EXEC01', sourceIp: '10.0.0.14', status: 'FAILURE', action: 'An account failed to log on' },
  { id: 'E-103', timestamp: '09/16, 14:02:49', eventId: '4769', user: 'svc_backup', host: 'WS-HR03', sourceIp: '172.16.0.88', status: 'SUCCESS', action: 'Kerberos service ticket requested' },
  { id: 'E-104', timestamp: '09/16, 14:02:47', eventId: '4672', user: 'jsmith', host: 'WS-DEV04', sourceIp: '10.10.5.33', status: 'SUCCESS', action: 'Special privileges assigned' },
  { id: 'E-105', timestamp: '09/16, 14:02:46', eventId: '4672', user: 'agarcia', host: 'WS-HR03', sourceIp: '203.45.78.12', status: 'SUCCESS', action: 'Special privileges assigned' },
  { id: 'E-106', timestamp: '09/16, 14:02:44', eventId: '4624', user: 'mchen', host: 'SRV-DB01', sourceIp: '10.0.0.14', status: 'SUCCESS', action: 'An account was successfully logged on' },
  { id: 'E-107', timestamp: '09/16, 14:02:42', eventId: '4720', user: 'lthomas', host: 'WS-DEV04', sourceIp: '10.10.5.33', status: 'SUCCESS', action: 'A user account was created' },
  { id: 'E-108', timestamp: '09/16, 14:02:40', eventId: '4728', user: 'admin', host: 'WS-HR03', sourceIp: '172.16.0.88', status: 'SUCCESS', action: 'Member added to security group' }
];

const INITIAL_ALERTS = [
  { id: 'ALT-901', severity: 'Critical', rule: 'Password Spray', score: 86, user: 'kwilson', host: 'WS-DEV04', sourceIp: '192.168.1.15', timestamp: '14:02:49', detail: 'Rapid authentication failures across multiple accounts from single IP.' },
  { id: 'ALT-902', severity: 'High', rule: 'ML Behavioral Anomaly', score: 79, user: 'mchen', host: 'DC-PROD01', sourceIp: '10.0.0.14', timestamp: '14:02:44', detail: 'User accessed sensitive DC host outside baseline working hours.' },
  { id: 'ALT-903', severity: 'Low', rule: 'Account Lockout', score: 21, user: 'admin', host: 'SRV-FILE02', sourceIp: '10.0.0.2', timestamp: '14:02:30', detail: 'Account exceeded failed logon threshold and was locked out.' },
  { id: 'ALT-904', severity: 'Low', rule: 'Account Lockout', score: 19, user: 'svc_backup', host: 'WS-HR03', sourceIp: '172.16.0.88', timestamp: '14:02:15', detail: 'Service account failed automated backup task auth.' },
  { id: 'ALT-905', severity: 'Critical', rule: 'Privilege Escalation', score: 92, user: 'j.chen', host: 'DC01', sourceIp: '192.168.1.10', timestamp: '13:58:00', detail: 'Account assigned Domain Admin rights without change request ticket.' }
];

const HIGH_RISK_USERS = [
  { username: 'j.chen', dept: 'Finance', score: 97, severity: 'Critical', status: 'Active' },
  { username: 'svc.monitor', dept: 'Operations', score: 88, severity: 'Critical', status: 'Active' },
  { username: 'a.smith', dept: 'IT', score: 72, severity: 'High', status: 'Active' },
  { username: 'k.wilson', dept: 'Engineering', score: 55, severity: 'Medium', status: 'Monitored' },
  { username: 'm.davis', dept: 'HR', score: 38, severity: 'Medium', status: 'Monitored' }
];

const HIGH_RISK_HOSTS = [
  { hostname: 'DC01', ip: '192.168.1.10', score: 95, severity: 'Critical' },
  { hostname: 'WS-FINANCE-03', ip: '192.168.1.103', score: 78, severity: 'High' },
  { hostname: 'WS-ADMIN-01', ip: '192.168.1.50', score: 62, severity: 'High' },
  { hostname: 'WS-HR-02', ip: '192.168.1.88', score: 32, severity: 'Medium' }
];

const EVENT_ACTIVITY_DATA = [
  { time: '00:00', events: 1 }, { time: '02:00', events: 21 }, { time: '04:00', events: 0 },
  { time: '06:00', events: 1 }, { time: '08:00', events: 8 }, { time: '10:00', events: 11 },
  { time: '12:00', events: 14 }, { time: '14:00', events: 9 }, { time: '16:00', events: 14 },
  { time: '18:00', events: 1 }, { time: '20:00', events: 3 }
];

const SEVERITY_DISTRIBUTION = [
  { name: 'Critical', value: 3, color: SEVERITY_COLORS.Critical },
  { name: 'High', value: 3, color: SEVERITY_COLORS.High },
  { name: 'Medium', value: 2, color: SEVERITY_COLORS.Medium },
  { name: 'Low', value: 1, color: SEVERITY_COLORS.Low }
];

const DETECTION_TYPES_DATA = [
  { name: 'Password Spray', count: 1.2 },
  { name: 'Brute Force', count: 3.0 },
  { name: 'Priv. Escalation', count: 0.8 },
  { name: 'Kerberos', count: 1.5 },
  { name: 'ML Anomaly', count: 2.2 },
  { name: 'Unusual Login', count: 1.9 },
  { name: 'Account Lockout', count: 1.1 }
];

const INCIDENTS_DATA = [
  { id: 'INC-2026-01', title: 'Domain Admin Privilege Escalation & Persistence', risk: 'Critical', score: 95, status: 'OPEN', users: 2, hosts: 2, firstSeen: '13:45:00', lastSeen: '14:02:53', description: 'Correlated pattern detected starting with password spraying, followed by a successful logon and privilege escalation on DC01.' },
  { id: 'INC-2026-02', title: 'Unusual Kerberos Ticket Volume (AS-REP Roasting)', risk: 'High', score: 78, status: 'INVESTIGATING', users: 1, hosts: 3, firstSeen: '11:20:12', lastSeen: '13:10:00', description: 'Abnormal spike in Kerberos service ticket requests for accounts without pre-authentication required.' },
  { id: 'INC-2026-03', title: 'Off-hours Lateral Movement via SMB', risk: 'Medium', score: 58, status: 'OPEN', users: 1, hosts: 4, firstSeen: '02:15:33', lastSeen: '03:00:10', description: 'Non-standard interactive logon across multiple Finance department workstations during off-hours window.' }
];

const DETECTION_RULES = [
  { name: 'Brute Force Detection', type: 'Authentication', severity: 'High', logic: 'Failures > 10 in 60s from single source', alerts: 14, enabled: true },
  { name: 'Password Spraying', type: 'Authentication', severity: 'Critical', logic: 'Failures across > 5 accounts from single IP', alerts: 8, enabled: true },
  { name: 'Unusual Logon Time', type: 'Behavioral Baseline', severity: 'Medium', logic: 'Logon activity outside 3-sigma time range', alerts: 22, enabled: true },
  { name: 'New Account Creation', type: 'Active Directory', severity: 'Low', logic: 'Event 4720 generated outside change window', alerts: 5, enabled: false },
  { name: 'Privilege Escalation', type: 'Active Directory', severity: 'Critical', logic: 'Member added to Domain Admins or Enterprise Admins', alerts: 3, enabled: true },
  { name: 'Account Lockout Burst', type: 'Authentication', severity: 'Medium', logic: '> 3 accounts locked out within 5 minutes', alerts: 9, enabled: true },
  { name: 'Suspicious Kerberos Ticket', type: 'Kerberos Protocol', severity: 'High', logic: 'Ticket request with weak encryption (RC4) or abnormal length', alerts: 6, enabled: true }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLive, setIsLive] = useState(true);
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [alertFilter, setAlertFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Simulation of incoming live streaming events
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const eventIds = ['4624', '4625', '4728', '4672', '4769'];
      const users = ['admin', 'j.chen', 'svc_backup', 'mchen', 'kwilson', 'agarcia'];
      const hosts = ['DC01', 'WS-HR03', 'SRV-DB01', 'WS-EXEC01', 'WS-DEV04'];
      const statuses = ['SUCCESS', 'SUCCESS', 'FAILURE', 'SUCCESS'];

      const randomEvt = eventIds[Math.floor(Math.random() * eventIds.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomHost = hosts[Math.floor(Math.random() * hosts.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      const newEvt = {
        id: `E-${Math.floor(100 + Math.random() * 900)}`,
        timestamp: `09/16, ${timeStr}`,
        eventId: randomEvt,
        user: randomUser,
        host: randomHost,
        sourceIp: `10.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
        status: randomStatus,
        action: randomStatus === 'FAILURE' ? 'An account failed to log on' : 'Successful security audit event'
      };

      setEvents(prev => [newEvt, ...prev.slice(0, 19)]);
      setStats(prev => ({ ...prev, totalEvents: prev.totalEvents + 1 }));
    }, 4000);

    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div className="cyber-app">
      {/* GLOBAL STYLES & CRT SCANLINE EFFECTS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background-color: #0a0e1a;
          color: #e2e8f0;
          font-family: 'Share Tech Mono', monospace;
          overflow-x: hidden;
        }

        .cyber-app {
          display: flex;
          min-height: 100vh;
          background: #0a0e1a;
          position: relative;
        }

        /* Scanline Overlay */
        .cyber-app::after {
          content: " ";
          position: fixed;
          top: 0; left: 0; bottom: 0; right: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
          pointer-events: none;
          z-index: 999;
          background-size: 100% 3px, 6px 100%;
          opacity: 0.6;
        }

        /* Glow effects */
        .neon-glow-cyan {
          text-shadow: 0 0 8px #00e5ff, 0 0 15px #00e5ff;
        }
        .neon-glow-green {
          text-shadow: 0 0 8px #00ff9f, 0 0 15px #00ff9f;
        }
        .neon-border {
          border: 1px solid #1e3a5f;
          box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.05);
        }
        .neon-border:hover {
          border-color: #00e5ff;
          box-shadow: 0 0 12px rgba(0, 229, 255, 0.2);
        }

        /* Sidebar Styling */
        .sidebar {
          width: 250px;
          background: #0d1222;
          border-right: 1px solid #1e3a5f;
          display: flex;
          flex-direction: column;
          z-index: 10;
        }

        .sidebar-brand {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #1e3a5f;
        }

        .brand-title {
          font-family: 'Orbitron', monospace;
          font-weight: 900;
          font-size: 1.1rem;
          color: #00e5ff;
          letter-spacing: 2px;
        }

        .sidebar-menu {
          list-style: none;
          padding: 20px 0;
        }

        .menu-item {
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          color: #94a3b8;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.2s;
          border-left: 3px solid transparent;
        }

        .menu-item:hover, .menu-item.active {
          color: #00e5ff;
          background: rgba(0, 229, 255, 0.05);
          border-left-color: #00e5ff;
        }

        /* Main Viewport */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          max-height: 100vh;
        }

        .top-header {
          background: #0d1222;
          border-bottom: 1px solid #1e3a5f;
          padding: 15px 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .page-title {
          font-family: 'Orbitron', monospace;
          font-size: 1.2rem;
          color: #ffffff;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 0.85rem;
        }

        .btn-cyber {
          background: #0d1222;
          border: 1px solid #00e5ff;
          color: #00e5ff;
          padding: 6px 14px;
          font-family: 'Share Tech Mono', monospace;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .btn-cyber:hover {
          background: #00e5ff;
          color: #0a0e1a;
          box-shadow: 0 0 10px #00e5ff;
        }

        .dashboard-grid {
          padding: 25px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .card-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 15px;
        }

        .cyber-card {
          background: #0f1628;
          border: 1px solid #1e3a5f;
          padding: 18px;
          position: relative;
        }

        .card-title {
          font-size: 0.75rem;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
        }

        .card-value {
          font-family: 'Orbitron', monospace;
          font-size: 2rem;
          color: #00e5ff;
          font-weight: 700;
        }

        .grid-2col {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
        }

        .grid-3col {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
        }

        /* Cyber Table */
        .cyber-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          text-align: left;
        }

        .cyber-table th {
          border-bottom: 1px solid #1e3a5f;
          padding: 10px 12px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: normal;
        }

        .cyber-table td {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(30, 58, 95, 0.4);
        }

        .cyber-table tr:hover {
          background: rgba(0, 229, 255, 0.03);
          cursor: pointer;
        }

        .badge-severity {
          padding: 2px 8px;
          font-size: 0.7rem;
          text-transform: uppercase;
          font-weight: bold;
          border-radius: 2px;
          display: inline-block;
        }

        /* Modal / Evidence Panel Overlay */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(10, 14, 26, 0.85);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-container {
          background: #0f1628;
          border: 1px solid #00e5ff;
          box-shadow: 0 0 20px rgba(0, 229, 255, 0.2);
          width: 650px;
          max-width: 90vw;
          max-height: 85vh;
          overflow-y: auto;
          padding: 25px;
        }
      `}</style>

      {/* --- SIDEBAR NAVIGATION --- */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Zap color="#00e5ff" size={24} />
          <div>
            <div className="brand-title">CYBER DNA</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '1px' }}>THREAT ANALYTICS v2.6</div>
          </div>
        </div>

        <ul className="sidebar-menu">
          <li className={`menu-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Activity size={18} /> Overview
          </li>
          <li className={`menu-item ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
            <AlertTriangle size={18} /> Alerts <span style={{ marginLeft: 'auto', background: '#ff2d55', color: '#fff', fontSize: '0.65rem', padding: '1px 6px' }}>{stats.activeAlerts}</span>
          </li>
          <li className={`menu-item ${activeTab === 'incidents' ? 'active' : ''}`} onClick={() => setActiveTab('incidents')}>
            <Layers size={18} /> Incidents
          </li>
          <li className={`menu-item ${activeTab === 'userDna' ? 'active' : ''}`} onClick={() => setActiveTab('userDna')}>
            <User size={18} /> User DNA
          </li>
          <li className={`menu-item ${activeTab === 'hosts' ? 'active' : ''}`} onClick={() => setActiveTab('hosts')}>
            <Server size={18} /> Hosts
          </li>
          <li className={`menu-item ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>
            <Shield size={18} /> Detection Rules
          </li>
          <li className={`menu-item ${activeTab === 'risk' ? 'active' : ''}`} onClick={() => setActiveTab('risk')}>
            <Cpu size={18} /> Risk Engine
          </li>
        </ul>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="main-content">
        {/* TOP NAVBAR */}
        <header className="top-header">
          <div className="page-title">{activeTab}</div>
          <div className="header-controls">
            <span>{stats.totalEvents} evt</span>
            <span>{stats.activeAlerts} alrt</span>
            <button className="btn-cyber" onClick={() => setIsLive(!isLive)}>
              {isLive ? <Pause size={14} /> : <Play size={14} />}
              {isLive ? 'PAUSE' : 'RESUME'}
            </button>
            <span style={{ color: isLive ? '#00ff9f' : '#ff2d55' }}>
              ● {isLive ? 'LIVE' : 'PAUSED'}
            </span>
            <span style={{ color: '#64748b' }}>{new Date().toISOString().substring(11, 19)} UTC</span>
          </div>
        </header>

        {/* PAGE CONTENT ROUTER */}
        <div className="dashboard-grid">
          {activeTab === 'overview' && (
            <OverviewTab 
              stats={stats} 
              events={events} 
              alerts={alerts} 
              setSelectedAlert={setSelectedAlert}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsTab 
              alerts={alerts} 
              filter={alertFilter} 
              setFilter={setAlertFilter} 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setSelectedAlert={setSelectedAlert}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentsTab 
              incidents={INCIDENTS_DATA} 
              setSelectedIncident={setSelectedIncident}
            />
          )}

          {activeTab === 'userDna' && (
            <UserDnaTab 
              users={HIGH_RISK_USERS} 
              setSelectedUser={setSelectedUser}
            />
          )}

          {activeTab === 'hosts' && (
            <HostsTab hosts={HIGH_RISK_HOSTS} />
          )}

          {activeTab === 'rules' && (
            <DetectionRulesTab rules={DETECTION_RULES} />
          )}

          {activeTab === 'risk' && (
            <RiskEngineTab />
          )}
        </div>
      </main>

      {/* --- MODAL DIALOGS --- */}
      {selectedAlert && (
        <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}

      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {selectedIncident && (
        <IncidentDetailModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS (TABS & MODALS)
// ============================================================================

function OverviewTab({ stats, events, alerts, setSelectedAlert }) {
  return (
    <>
      {/* STAT CARDS */}
      <div className="card-row">
        <div className="cyber-card">
          <div className="card-title">TOTAL EVENTS</div>
          <div className="card-value">{stats.totalEvents}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>Including live stream</div>
        </div>
        <div className="cyber-card">
          <div className="card-title">ACTIVE ALERTS</div>
          <div className="card-value" style={{ color: '#ff9f0a' }}>{stats.activeAlerts}</div>
          <div style={{ fontSize: '0.7rem', color: '#00ff9f', marginTop: '4px' }}>+15 live</div>
        </div>
        <div className="cyber-card">
          <div className="card-title">OPEN INCIDENTS</div>
          <div className="card-value" style={{ color: '#ff2d55' }}>{stats.openIncidents}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>3 total correlated</div>
        </div>
        <div className="cyber-card">
          <div className="card-title">HIGH-RISK USERS</div>
          <div className="card-value">{stats.highRiskUsers}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>of 5 monitored</div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid-2col">
        <div className="cyber-card">
          <div className="card-title">EVENT ACTIVITY - 24H</div>
          <div style={{ height: '180px', width: '100%', marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={EVENT_ACTIVITY_DATA}>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f1628', borderColor: '#00e5ff' }} />
                <Area type="monotone" dataKey="events" stroke="#00e5ff" fill="rgba(0, 229, 255, 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cyber-card">
          <div className="card-title">ALERT SEVERITY DISTRIBUTION</div>
          <div style={{ height: '180px', width: '100%', display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={SEVERITY_DISTRIBUTION} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                  {SEVERITY_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f1628', borderColor: '#00e5ff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* BOTTOM DATA TABLES */}
      <div className="grid-2col">
        <div className="cyber-card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>LIVE EVENT FEED</span>
            <span style={{ color: '#00ff9f' }}>● STREAMING</span>
          </div>
          <table className="cyber-table" style={{ marginTop: '10px' }}>
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>EVENT ID</th>
                <th>USER</th>
                <th>HOST</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 6).map(evt => (
                <tr key={evt.id}>
                  <td style={{ color: '#64748b' }}>{evt.timestamp}</td>
                  <td style={{ color: '#00e5ff' }}>{evt.eventId}</td>
                  <td>{evt.user}</td>
                  <td>{evt.host}</td>
                  <td style={{ color: evt.status === 'SUCCESS' ? '#00ff9f' : '#ff2d55' }}>{evt.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cyber-card">
          <div className="card-title">TOP HIGH-RISK USERS</div>
          <table className="cyber-table" style={{ marginTop: '10px' }}>
            <thead>
              <tr>
                <th>USER</th>
                <th>DEPT</th>
                <th>SCORE</th>
                <th>SEVERITY</th>
              </tr>
            </thead>
            <tbody>
              {HIGH_RISK_USERS.map(u => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td style={{ color: '#64748b' }}>{u.dept}</td>
                  <td style={{ color: SEVERITY_COLORS[u.severity], fontWeight: 'bold' }}>{u.score}</td>
                  <td>
                    <span className="badge-severity" style={{ background: `${SEVERITY_COLORS[u.severity]}20`, color: SEVERITY_COLORS[u.severity], border: `1px solid ${SEVERITY_COLORS[u.severity]}` }}>
                      {u.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function AlertsTab({ alerts, filter, setFilter, searchQuery, setSearchQuery, setSelectedAlert }) {
  const filteredAlerts = alerts.filter(a => {
    if (filter !== 'ALL' && a.severity.toUpperCase() !== filter) return false;
    if (searchQuery && !a.rule.toLowerCase().includes(searchQuery.toLowerCase()) && !a.user.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="cyber-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
            <button 
              key={f} 
              className="btn-cyber" 
              style={{ background: filter === f ? '#00e5ff' : '#0d1222', color: filter === f ? '#0a0e1a' : '#00e5ff' }}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #1e3a5f', padding: '4px 10px', background: '#0d1222' }}>
          <Search size={14} color="#64748b" />
          <input 
            type="text" 
            placeholder="Search alerts or users..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontFamily: 'Share Tech Mono', outline: 'none' }}
          />
        </div>
      </div>

      <table className="cyber-table">
        <thead>
          <tr>
            <th>SEVERITY</th>
            <th>RULE NAME</th>
            <th>USER</th>
            <th>HOST</th>
            <th>SOURCE IP</th>
            <th>TIME</th>
            <th>SCORE</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {filteredAlerts.map(alt => (
            <tr key={alt.id} onClick={() => setSelectedAlert(alt)}>
              <td>
                <span className="badge-severity" style={{ background: `${SEVERITY_COLORS[alt.severity]}20`, color: SEVERITY_COLORS[alt.severity], border: `1px solid ${SEVERITY_COLORS[alt.severity]}` }}>
                  {alt.severity}
                </span>
              </td>
              <td style={{ color: '#ffffff', fontWeight: 'bold' }}>{alt.rule}</td>
              <td>{alt.user}</td>
              <td>{alt.host}</td>
              <td style={{ color: '#64748b' }}>{alt.sourceIp}</td>
              <td style={{ color: '#64748b' }}>{alt.timestamp}</td>
              <td style={{ color: SEVERITY_COLORS[alt.severity], fontWeight: 'bold' }}>{alt.score}</td>
              <td>
                <button className="btn-cyber" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                  <Eye size={12} /> INVESTIGATE
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IncidentsTab({ incidents, setSelectedIncident }) {
  return (
    <div className="cyber-card">
      <div className="card-title" style={{ marginBottom: '15px' }}>CORRELATED SECURITY INCIDENTS</div>
      <table className="cyber-table">
        <thead>
          <tr>
            <th>INCIDENT ID</th>
            <th>TITLE</th>
            <th>RISK LEVEL</th>
            <th>STATUS</th>
            <th>AFFECTED USERS</th>
            <th>AFFECTED HOSTS</th>
            <th>FIRST SEEN</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map(inc => (
            <tr key={inc.id} onClick={() => setSelectedIncident(inc)}>
              <td style={{ color: '#00e5ff' }}>{inc.id}</td>
              <td style={{ color: '#fff', fontWeight: 'bold' }}>{inc.title}</td>
              <td>
                <span className="badge-severity" style={{ background: `${SEVERITY_COLORS[inc.risk]}20`, color: SEVERITY_COLORS[inc.risk], border: `1px solid ${SEVERITY_COLORS[inc.risk]}` }}>
                  {inc.risk} ({inc.score})
                </span>
              </td>
              <td style={{ color: inc.status === 'OPEN' ? '#ff2d55' : '#ff9f0a' }}>{inc.status}</td>
              <td>{inc.users} Accounts</td>
              <td>{inc.hosts} Hosts</td>
              <td style={{ color: '#64748b' }}>{inc.firstSeen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserDnaTab({ users, setSelectedUser }) {
  return (
    <div className="cyber-card">
      <div className="card-title" style={{ marginBottom: '15px' }}>MONITORED USER BEHAVIORAL PROFILES (DNA)</div>
      <table className="cyber-table">
        <thead>
          <tr>
            <th>USERNAME</th>
            <th>DEPARTMENT</th>
            <th>RISK SCORE</th>
            <th>RISK STATUS</th>
            <th>BEHAVIORAL DEVIATION</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.username} onClick={() => setSelectedUser(u)}>
              <td style={{ color: '#00e5ff', fontWeight: 'bold' }}>{u.username}</td>
              <td style={{ color: '#64748b' }}>{u.dept}</td>
              <td style={{ color: SEVERITY_COLORS[u.severity], fontWeight: 'bold' }}>{u.score} / 100</td>
              <td>
                <span className="badge-severity" style={{ background: `${SEVERITY_COLORS[u.severity]}20`, color: SEVERITY_COLORS[u.severity], border: `1px solid ${SEVERITY_COLORS[u.severity]}` }}>
                  {u.severity}
                </span>
              </td>
              <td style={{ color: u.score > 70 ? '#ff2d55' : '#00ff9f' }}>
                {u.score > 70 ? 'High Off-hours & Privilege Anomaly' : 'Normal Baseline Alignment'}
              </td>
              <td>
                <button className="btn-cyber" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>VIEW DNA STRAND</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HostsTab({ hosts }) {
  return (
    <div className="cyber-card">
      <div className="card-title" style={{ marginBottom: '15px' }}>MONITORED HOST INFRASTRUCTURE</div>
      <table className="cyber-table">
        <thead>
          <tr>
            <th>HOSTNAME</th>
            <th>IP ADDRESS</th>
            <th>RISK SCORE</th>
            <th>STATUS</th>
            <th>UNUSUAL ACTIVITY FLAGS</th>
          </tr>
        </thead>
        <tbody>
          {hosts.map(h => (
            <tr key={h.hostname}>
              <td style={{ color: '#00e5ff', fontWeight: 'bold' }}>{h.hostname}</td>
              <td style={{ color: '#64748b' }}>{h.ip}</td>
              <td style={{ color: SEVERITY_COLORS[h.severity], fontWeight: 'bold' }}>{h.score}</td>
              <td>
                <span className="badge-severity" style={{ background: `${SEVERITY_COLORS[h.severity]}20`, color: SEVERITY_COLORS[h.severity], border: `1px solid ${SEVERITY_COLORS[h.severity]}` }}>
                  {h.severity}
                </span>
              </td>
              <td style={{ color: h.score > 70 ? '#ff2d55' : '#00ff9f' }}>
                {h.score > 70 ? 'Unusual authentication target burst' : 'Standard service baseline'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetectionRulesTab({ rules }) {
  return (
    <div className="cyber-card">
      <div className="card-title" style={{ marginBottom: '15px' }}>ACTIVE ACTIVE DIRECTORY DETECTION RULES</div>
      <table className="cyber-table">
        <thead>
          <tr>
            <th>RULE NAME</th>
            <th>TYPE</th>
            <th>SEVERITY</th>
            <th>TRIGGER LOGIC</th>
            <th>ALERTS FIRED</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.name}>
              <td style={{ color: '#fff', fontWeight: 'bold' }}>{r.name}</td>
              <td style={{ color: '#64748b' }}>{r.type}</td>
              <td>
                <span className="badge-severity" style={{ background: `${SEVERITY_COLORS[r.severity]}20`, color: SEVERITY_COLORS[r.severity], border: `1px solid ${SEVERITY_COLORS[r.severity]}` }}>
                  {r.severity}
                </span>
              </td>
              <td style={{ color: '#00e5ff', fontSize: '0.8rem' }}>{r.logic}</td>
              <td>{r.alerts}</td>
              <td style={{ color: r.enabled ? '#00ff9f' : '#64748b' }}>
                {r.enabled ? 'ENABLED' : 'DISABLED'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskEngineTab() {
  return (
    <div className="cyber-card">
      <div className="card-title" style={{ marginBottom: '15px' }}>CYBER DNA RISK SCORING ENGINE FORMULA</div>
      <div style={{ background: '#0d1222', padding: '20px', border: '1px solid #1e3a5f', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: '1.1rem', color: '#00e5ff', marginBottom: '10px' }}>
          FINAL RISK SCORE = MIN(100, RULE SCORE + ANOMALY CONTRIBUTION + CONTEXT CONTRIBUTION)
        </div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.6' }}>
          • <strong>Rule Base Score:</strong> Critical (+40), High (+25), Medium (+15), Low (+5)<br />
          • <strong>ML Anomaly Contribution:</strong> 0 to 25 points derived from Isolation Forest behavioral distance.<br />
          • <strong>Context Contribution:</strong> 0 to 15 points (Privileged Account: +10, Sensitive Target Host: +5).
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL COMPONENTS
// ============================================================================

function AlertDetailModal({ alert, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e3a5f', paddingBottom: '10px', marginBottom: '15px' }}>
          <span style={{ fontFamily: 'Orbitron', color: '#00e5ff' }}>EVIDENCE PANEL - {alert.id}</span>
          <button className="btn-cyber" onClick={onClose} style={{ padding: '2px 8px' }}>X</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
          <div><strong>Rule Name:</strong> {alert.rule}</div>
          <div><strong>Severity:</strong> <span style={{ color: SEVERITY_COLORS[alert.severity] }}>{alert.severity} ({alert.score}/100)</span></div>
          <div><strong>Target User:</strong> {alert.user}</div>
          <div><strong>Target Host:</strong> {alert.host}</div>
          <div><strong>Source IP:</strong> {alert.sourceIp}</div>
          <div style={{ background: '#0d1222', padding: '10px', border: '1px solid #1e3a5f', marginTop: '10px' }}>
            <strong style={{ color: '#00e5ff' }}>RAW EVIDENCE LOG:</strong>
            <p style={{ marginTop: '5px', color: '#94a3b8', fontSize: '0.8rem' }}>{alert.detail}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserDetailModal({ user, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e3a5f', paddingBottom: '10px', marginBottom: '15px' }}>
          <span style={{ fontFamily: 'Orbitron', color: '#00e5ff' }}>USER DNA PROFILE - {user.username}</span>
          <button className="btn-cyber" onClick={onClose} style={{ padding: '2px 8px' }}>X</button>
        </div>
        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div><strong>Department:</strong> {user.dept}</div>
          <div><strong>Risk Score:</strong> <span style={{ color: SEVERITY_COLORS[user.severity] }}>{user.score} / 100</span></div>
          <div style={{ background: '#0d1222', padding: '10px', border: '1px solid #1e3a5f', marginTop: '10px' }}>
            <strong style={{ color: '#00e5ff' }}>BEHAVIORAL BASELINE DNA:</strong>
            <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#94a3b8' }}>
              • Normal Hours: 08:00 - 17:00 UTC<br />
              • Typical Source IPs: 10.0.0.14, 192.168.1.10<br />
              • Recent Anomaly: Authentication spike observed at 02:14 UTC from non-standard IP subnet.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncidentDetailModal({ incident, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e3a5f', paddingBottom: '10px', marginBottom: '15px' }}>
          <span style={{ fontFamily: 'Orbitron', color: '#00e5ff' }}>INCIDENT INVESTIGATION - {incident.id}</span>
          <button className="btn-cyber" onClick={onClose} style={{ padding: '2px 8px' }}>X</button>
        </div>
        <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div><strong>Title:</strong> {incident.title}</div>
          <div><strong>Risk:</strong> <span style={{ color: SEVERITY_COLORS[incident.risk] }}>{incident.risk} ({incident.score})</span></div>
          <div><strong>Description:</strong> {incident.description}</div>
          <div style={{ background: '#0d1222', padding: '10px', border: '1px solid #1e3a5f', marginTop: '10px' }}>
            <strong style={{ color: '#00e5ff' }}>CORRELATED ATTACK TIMELINE:</strong>
            <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#94a3b8' }}>
              • {incident.firstSeen} - Initial password spray detected across accounts.<br />
              • {incident.lastSeen} - Privileged account assignment event (4728) registered.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}