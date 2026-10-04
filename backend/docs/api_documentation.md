# Cyber-DNA Backend API Documentation

Welcome to the Cyber-DNA Platform API documentation. This API provides endpoints for log ingestion, alert retrieval, entity management (Users/Computers), and ML analytics.

**Base URL:** `/api/v1`

---

## 1. Root
General API endpoints.

### `GET /`
Returns a welcome message indicating the API is running and accessible.

**Response**
```json
{
  "message": "Welcome to the Cyber-DNA Platform API"
}
```

---

## 2. Ingestion
Endpoints related to log ingestion from data sources like Winlogbeat.

### `POST /api/v1/ingest/`
Endpoint to receive raw logs from Winlogbeat or similar forwarders.

**Description:**
Processes incoming JSON payload, extracts Windows event logs, normalizes them, and stores them in the `events` table. 

**Request Body:**
Accepts a single JSON object or a list of JSON objects representing raw events.

**Success Response (200 OK):**
```json
{
  "status": "success",
  "processed_count": 15
}
```

---

## 3. Alerts
Endpoints related to retrieving security alerts.

### `GET /api/v1/alerts/`
Retrieve alerts for the SOC dashboard.

**Description:**
Fetches a paginated list of alerts, ordered by the most recent timestamp first. Includes related underlying events mapped via `alert_events`.

**Query Parameters:**
- `skip` (integer, optional): Pagination offset. Default `0`.
- `limit` (integer, optional): Max records to return. Default `100`.

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "timestamp": "2023-10-01T12:00:00Z",
    "alert_type": "Brute Force",
    "severity": "High",
    "username": "jdoe",
    "computer_id": 10,
    "source_ip": "192.168.1.100",
    "description": "5 failed logins detected",
    "status": "new",
    "detection_rule": 3,
    "created_at": "2023-10-01T12:00:05Z",
    "event_ids": [45, 46, 47, 48, 49]
  }
]
```

---

## 4. Entities (Users and Computers)
Endpoints related to Active Directory accounts and employee computers.

### `GET /api/v1/entities/users`
Retrieve user accounts.

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "username": "jdoe",
    "display_name": "John Doe",
    "domain": "CYBERDNA",
    "department": "Engineering",
    "role": "Developer",
    "status": "active"
  }
]
```

### `GET /api/v1/entities/computers`
Retrieve employee computers.

**Success Response (200 OK):**
```json
[
  {
    "id": 10,
    "hostname": "LAPTOP-JD",
    "ip_address": "192.168.1.100",
    "domain": "CYBERDNA",
    "operating_system": "Windows 11",
    "department": "Engineering",
    "status": "active"
  }
]
```

---

## 5. Machine Learning Analytics
Endpoints related to retrieving ML scoring.

### `GET /api/v1/ml/analytics`
Retrieve anomaly analysis.

**Success Response (200 OK):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "computer_id": 10,
    "analysis_time": "2023-10-01T12:30:00Z",
    "risk_score": 85.5,
    "anomaly_score": 0.95,
    "behavior_type": "Unusual Logon Time",
    "explanation": "User logged in at 3 AM outside of normal working hours.",
    "model_version": "v1.2.0"
  }
]
```
