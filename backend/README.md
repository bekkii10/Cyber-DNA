# Cyber-DNA Backend API

This is the FastAPI backend for the Cyber-DNA Threat Detection Platform. It handles log ingestion from Winlogbeat, parses and normalizes the data into PostgreSQL, and serves alerts and entity information to the frontend.

## Tech Stack
- **Framework:** FastAPI (Python)
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy
- **Data Validation:** Pydantic

## Getting Started

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Database Setup:**
   - Ensure PostgreSQL is running.
   - Create a database named `cyberdna`.
   - Copy `.env.example` to `.env` and update the credentials:
     ```bash
     cp .env.example .env
     ```

3. **Run the Application:**
   ```bash
   uvicorn app.main:app --reload
   ```

4. **API Documentation:**
   - Swagger UI: `http://localhost:8000/docs`
   - ReDoc: `http://localhost:8000/redoc`

## Structure
- `app/api/`: REST API endpoints and dependencies.
- `app/core/`: Configuration and settings.
- `app/db/`: Database setup and SQLAlchemy models (`events_raw`, `events_normalized`, etc.).
- `app/schemas/`: Pydantic models for data validation.
- `app/services/`: Core logic like parsing and normalising Winlogbeat logs.
