import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine, Base
from app.db.models import (
    User, Computer, Event, DetectionRule, Alert, 
    Incident, MLAnalytics, Session as UserSession
)

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Create Users
    users_data = [
        {"username": "admin.john", "department": "IT", "status": "Active", "risk_score": 85.0},
        {"username": "sifen.melaku", "department": "Finance", "status": "Active", "risk_score": 12.5},
        {"username": "j.chen", "department": "HR", "status": "Active", "risk_score": 92.0},
        {"username": "svc_sql", "department": "Service Accounts", "status": "Active", "risk_score": 5.0}
    ]
    
    db_users = {}
    for ud in users_data:
        user = User(**ud)
        db.add(user)
        db_users[ud["username"]] = user
    db.commit()

    # 2. Create Computers
    comps_data = [
        {"hostname": "DC01", "ip_address": "192.168.1.10", "status": "online", "risk_score": 95.0},
        {"hostname": "WIN-CLIENT01", "ip_address": "192.168.56.102", "status": "online", "risk_score": 10.0},
        {"hostname": "HR-DESKTOP", "ip_address": "192.168.56.105", "status": "offline", "risk_score": 25.0}
    ]
    
    db_comps = {}
    for cd in comps_data:
        comp = Computer(**cd)
        db.add(comp)
        db_comps[cd["hostname"]] = comp
    db.commit()

    # Link users to computers (user_computer)
    db_users["sifen.melaku"].computers.append(db_comps["WIN-CLIENT01"])
    db_users["j.chen"].computers.append(db_comps["HR-DESKTOP"])
    db_users["admin.john"].computers.append(db_comps["DC01"])
    db.commit()

    # 3. Create Detection Rules
    rules_data = [
        {
            "id": "RULE-001", "name": "Brute Force Detection", 
            "type": "Authentication", "severity": "High", 
            "logic": "Failures > 10 in 60s", "enabled": True, "alert_count": 1
        },
        {
            "id": "RULE-002", "name": "Privilege Escalation", 
            "type": "Access", "severity": "Critical", 
            "logic": "Admin group modification", "enabled": True, "alert_count": 1
        }
    ]
    
    db_rules = {}
    for rd in rules_data:
        rule = DetectionRule(**rd)
        db.add(rule)
        db_rules[rd["id"]] = rule
    db.commit()

    # 4. Create Events
    now = datetime.now(timezone.utc)
    
    events_data = [
        {
            "timestamp": now - timedelta(hours=2), "event_id": 4624, "username": "sifen.melaku", 
            "domain": "corp.local", "logon_type": 3, "source_ip": "192.168.56.102", 
            "computer_id": db_comps["WIN-CLIENT01"].id, "result": "SUCCESS", "action": "Successful logon",
            "event_details": {"authentication_package": "Kerberos"}
        },
        {
            "timestamp": now - timedelta(minutes=30), "event_id": 4625, "username": "admin.john", 
            "domain": "corp.local", "logon_type": 3, "source_ip": "10.0.0.99", 
            "computer_id": db_comps["DC01"].id, "result": "FAILURE", "action": "Failed logon",
            "event_details": {"failure_reason": "Unknown user name or bad password."}
        },
        {
            "timestamp": now - timedelta(minutes=29), "event_id": 4625, "username": "admin.john", 
            "domain": "corp.local", "logon_type": 3, "source_ip": "10.0.0.99", 
            "computer_id": db_comps["DC01"].id, "result": "FAILURE", "action": "Failed logon",
            "event_details": {"failure_reason": "Unknown user name or bad password."}
        },
        {
            "timestamp": now - timedelta(minutes=28), "event_id": 4624, "username": "admin.john", 
            "domain": "corp.local", "logon_type": 3, "source_ip": "10.0.0.99", 
            "computer_id": db_comps["DC01"].id, "result": "SUCCESS", "action": "Successful logon",
            "event_details": {"authentication_package": "NTLM"}
        },
        {
            "timestamp": now - timedelta(minutes=15), "event_id": 4728, "username": "j.chen", 
            "domain": "corp.local", "logon_type": None, "source_ip": "192.168.56.105", 
            "computer_id": db_comps["DC01"].id, "result": "EVENT", "action": "Member added to security-enabled global group",
            "event_details": {"target_group": "Domain Admins", "member": "j.chen"}
        }
    ]
    
    db_events = []
    for ed in events_data:
        event = Event(**ed)
        db.add(event)
        db_events.append(event)
    db.commit()

    # 5. Create Incidents
    inc1 = Incident(
        id="INC-2026-01", title="Suspicious Admin Activity", risk="Critical", 
        score=95.0, status="OPEN", first_seen=now - timedelta(minutes=30), last_seen=now
    )
    db.add(inc1)
    db.commit()

    # 6. Create Alerts and link to Events
    alert1 = Alert(
        id="ALT-901", incident_id="INC-2026-01", rule_id="RULE-001", 
        severity="High", score=85.0, user="admin.john", host="DC01", 
        ip="10.0.0.99", time=now - timedelta(minutes=29), 
        detail="Possible Brute Force Attack", source="Windows Security Event 4625", 
        explanation="Multiple failed logins followed by a success from a new IP."
    )
    alert1.events.append(db_events[1])
    alert1.events.append(db_events[2])
    alert1.events.append(db_events[3])
    
    alert2 = Alert(
        id="ALT-902", incident_id="INC-2026-01", rule_id="RULE-002", 
        severity="Critical", score=98.0, user="j.chen", host="DC01", 
        ip="192.168.56.105", time=now - timedelta(minutes=15), 
        detail="Unauthorized Privilege Escalation", source="Windows Security Event 4728", 
        explanation="User j.chen added themselves to Domain Admins."
    )
    alert2.events.append(db_events[4])
    
    db.add(alert1)
    db.add(alert2)
    db.commit()

    # 7. Add ML Analytics
    ml = MLAnalytics(
        user_id=db_users["j.chen"].id, computer_id=db_comps["HR-DESKTOP"].id,
        risk_score=92.0, explanation="Anomalous behavior: user interacting with Domain Controllers at unusual times.",
        recommendations="Isolate host, reset credentials."
    )
    db.add(ml)
    
    # 8. Add Sessions
    sess = UserSession(
        user_id=db_users["sifen.melaku"].id, computer_id=db_comps["WIN-CLIENT01"].id,
        login_time=now - timedelta(hours=2)
    )
    db.add(sess)
    
    db.commit()
    print("Database successfully seeded with realistic test data!")

if __name__ == "__main__":
    seed_data()
