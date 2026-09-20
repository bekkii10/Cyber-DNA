# Backend Architecture (Python & FastAPI)

## 1. Overview
The backend acts as the central hub of the Behavioral Analytics and Threat Detection Platform. Built with Python and FastAPI, it is responsible for data ingestion, log parsing, running deterministic and behavioral detection engines, and providing a RESTful API for the frontend dashboard. It strictly interacts with a PostgreSQL database to manage its state and analytics data.

## 2. Core Components

### 2.1 Ingestion API
- **Framework**: FastAPI
- **Purpose**: Exposes secure REST endpoints specifically designed to receive raw Windows Event Logs (JSON) forwarded by collector agents like Winlogbeat.
- **Workflow**: Validates incoming payload schemas, sanitizes inputs, and passes the data to the Parser & Normalizer.

### 2.2 Parser & Normalizer
- **Purpose**: Extracts critical fields from the complex raw JSON logs.
- **Data Extracted**: `timestamp`, `event_type` (Event ID), `user`, `computer`, `source_ip`, `status`.
- **Workflow**: 
  - Saves the exact original payload to the `events_raw` table (for audit/retention).
  - Saves the parsed fields to the `events_normalized` table to enable fast querying and analytics.

### 2.3 Scheduled Detection & Analytics
The analytical core runs via a separate dedicated detection worker process (e.g., using `APScheduler`), rather than relying on FastAPI's background tasks. This ensures resource isolation between high-throughput log ingestion and heavy analytical database queries. The worker polls normalized logs at regular intervals (e.g., every 1-5 minutes).

#### Common Detection Contract
Both the Rule Engine and Behavioral Engine output findings using a common `DetectionResult` contract. This ensures the Correlation Engine can process them uniformly.

```json
{
  "engine_type": "rule | behavioral",
  "detection_name": "string",
  "entity_id": "string",
  "entity_type": "user | computer",
  "score": 0.85,
  "evidence": {
    "reason": "explanation string",
    "relevant_events": [1234, 1235]
  },
  "timestamp": "2024-05-12T03:15:00Z"
}
```
These results are written to a `detections` table before being correlated into a final Alert.

#### Rule Engine (Deterministic)
- Evaluates normalized events against static security signatures (e.g., Event ID 4720: Account Created, or 4625: Failed Logins).
- Outputs a `DetectionResult` with a fixed score indicating severity, attaching specific matching event logs as evidence.

#### Behavioral Engine (Probabilistic)
- **Feature Extraction**: Utilizes `Pandas` to aggregate events over time windows (e.g., "failed logins in the last hour", "distinct computers accessed today").
- **Anomaly Detection Algorithms**:
  - **Statistical Z-Score (Univariate)**: Compares a single feature against its historical mean and standard deviation. Simple and highly explainable. If the Z-score exceeds a threshold (e.g., > 3), it generates a `DetectionResult`.
  - **Isolation Forest (Multivariate)**: An unsupervised Machine Learning model from `Scikit-Learn` that evaluates multiple features simultaneously to find complex outliers that a single metric might miss.
- **Explanations**: The Behavioral Engine explicitly details which features drove the anomaly (e.g., "login_count was 50, expected range 0-5, z-score: 4.2") to ensure explainability in the `evidence` field of the `DetectionResult`.

### 2.4 Correlation & Risk Scorer
- Merges the `DetectionResult` records from the `detections` table based on the entity (User/Computer) over a specific time window.
- Calculates a Final Risk Score (0-100).
- If the score exceeds a predefined threshold, it creates a highly-explainable Alert payload and writes it to the `alerts` table.

### 2.5 Frontend REST API
- **Framework**: FastAPI
- **Purpose**: Serves the React SOC Dashboard.
- **Key Endpoints**:
  - `GET /api/v1/alerts`: Fetch all generated alerts (filterable, paginated).
  - `GET /api/v1/alerts/{id}`: Fetch detailed alert JSON (triggered rules, anomalies, explanations).
  - `GET /api/v1/entities/{id}/timeline`: Retrieve the chronological event log for a specific user/computer for incident investigation.
- **Security**: Secured via JWT (JSON Web Tokens) authentication.

## 3. Database Schema (PostgreSQL)

- **`events_raw`**: `id`, `timestamp`, `raw_json`
- **`events_normalized`**: `id`, `timestamp`, `event_type`, `user`, `computer`, `source_ip`, `status`
- **`entities`**: `id`, `type` (user/computer), `is_privileged`, `department`
- **`baselines`**: `entity_id`, `feature_name`, `mean`, `std_dev`
- **`detections`**: `id`, `engine_type`, `detection_name`, `entity_id`, `score`, `evidence`, `timestamp`
- **`alerts`**: `id`, `entity_id`, `risk_score`, `reasons_json`, `timestamp`

## 4. Proposed Folder Structure

```text
backend/
├── app/
│   ├── main.py                # FastAPI application instance & API routing
│   ├── worker.py              # Separate APScheduler detection worker
│   ├── api/                   # API Endpoints (Controllers)
│   │   ├── ingestion.py       
│   │   └── frontend.py        
│   ├── core/                  # App-wide configurations & security
│   ├── db/                    # Database Configuration (Session & Models)
│   ├── schemas/               # Pydantic Models 
│   │   ├── event.py           # Incoming logs
│   │   ├── detection.py       # DetectionResult contract schema
│   │   └── alert.py           # Outgoing alerts
│   ├── services/              # Business Logic
│   │   ├── normalizer.py      
│   │   └── correlation.py     # Risk score calculation (consumes detections)
│   └── analytics/             # Threat Detection Logic
│       ├── rules.py           # Deterministic detection signatures
│       ├── features.py        # Pandas time-series aggregation
│       └── models/            # Behavioral models
│           ├── zscore.py      # Statistical Z-Score anomaly detection
│           └── isolation.py   # Scikit-Learn Isolation Forest
├── tests/                     # Unit & integration tests
├── requirements.txt           # Python dependencies
└── .env                       # Environment variables
```

## 5. Scheduled Detection & Analytics Data Flow

1. **Ingest**: `POST /api/v1/ingest` receives JSON from Winlogbeat.
2. **Store**: FastAPI saves to `events_raw` and `events_normalized`.
3. **Poll**: The separate `worker.py` process (running `APScheduler`) polls `events_normalized` every 1-5 minutes.
4. **Detect**:
   - `rules.py` evaluates logs and generates `DetectionResult` records.
   - `models/zscore.py` & `models/isolation.py` evaluate logs and generate `DetectionResult` records based on behavioral anomalies.
   - All results are written to the intermediate `detections` table.
5. **Score**: `correlation.py` reads recent `detections`, computes the final combined risk score per entity, and if high, writes to `alerts`.
6. **Serve**: The UI calls `GET /api/v1/alerts` to present findings.
