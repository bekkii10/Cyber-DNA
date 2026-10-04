# Cyber-DNA Backend API

This is the FastAPI backend for the Cyber-DNA Threat Detection Platform. It handles log ingestion from Windows (via PowerShell collector), parses and normalizes the data, detects suspicious activity through behavioral rules/ML, and serves structured alerts to the React dashboard.

## Tech Stack
- **Framework:** FastAPI (Python)
- **Database:** SQLite (default) / PostgreSQL
- **ORM:** SQLAlchemy
- **Data Validation:** Pydantic

## Getting Started

1. **Set up a Virtual Environment:**
   It is highly recommended to run the backend within a virtual environment to isolate its dependencies.
   
   - **Linux/macOS:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows:**
     ```cmd
     python -m venv venv
     venv\Scripts\activate
     ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Database Setup:**
   - The system defaults to SQLite (`cyberdna.db`) for testing and prototyping.
   - For PostgreSQL, copy `.env.example` to `.env` and update the credentials.

4. **Run the Application:**
   ```bash
   uvicorn app.main:app --reload
   ```

5. **API Documentation:**
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

## Structure
- `app/api/endpoints/`: REST API endpoints grouped by domain (events, alerts, users, hosts, collector).
- `app/core/`: Configuration and environment variables.
- `app/db/`: Database connection and SQLAlchemy models (`events`, `alerts`, `users`, `computers`, `incidents`, `detection_rules`, `sessions`, `ml_analysis`).
- `app/schemas.py`: Pydantic models for data validation.

## Data Flow
1. **Windows Event** is collected and sent to `POST /api/collector/events`.
2. Stored in the **events** table.
3. **Detection Rules** / ML analyzes events.
4. If flagged, created as **alerts**.
5. Alerts are linked to multiple events via the **alert_events** junction table.
6. The Dashboard consumes data via `GET /api/alerts`, `GET /api/dashboard/overview`, etc.
