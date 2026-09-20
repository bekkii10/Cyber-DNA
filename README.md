# Development of an Intelligent Behavioral Analytics and Threat Detection Platform for Active Directory Environments

## Overview
This repository contains the source code and documentation for the **Development of an Intelligent Behavioral Analytics and Threat Detection Platform for Active Directory Environments**. This academic research project is designed to analyze Windows Event Logs and Active Directory context. The core thesis of this platform is to evaluate and compare traditional deterministic rule-based threat detection against probabilistic behavioral anomaly detection.

The platform processes telemetry from an isolated lab environment, evaluating data through independent Rule and Behavioral engines. It correlates these findings to generate explainable risk scores and visualizes entity timelines and alerts for SOC investigations.

## Academic Focus
- **Purpose:** To formally compare the effectiveness (Precision, Recall, F1-score) of Rule-based vs. Behavioral detection methodologies using a controlled lab and simulated ground truth.
- **Explainability:** All risk scores and generated alerts contain a traceable, human-readable justification. Black-box ML models are strictly avoided in favor of interpretable statistical methods (e.g., Isolation Forest, Z-Score).

## Architecture & Data Pipeline
The platform operates as a straightforward, modular pipeline:
1. **Collection:** Lightweight agents (Winlogbeat) forward core Windows Event Logs from a Domain Controller and client machines to a central ingestion API.
2. **Processing & Storage:** A Python (FastAPI) backend validates, normalizes, and stores the events in a PostgreSQL relational database.
3. **Detection (Asynchronous):** 
   - **Rule Engine:** Evaluates events against static, deterministic signatures (e.g., Account Created, Brute Force).
   - **Behavioral Engine:** Extracts features (e.g., login hours, frequency) and computes anomaly scores using statistical baselining.
4. **Correlation & Scoring:** Combines rule weights and anomaly scores based on the entity (User/Computer) to generate a final Risk Score and trigger necessary alerts.
5. **Presentation:** A React-based web dashboard displays generated alerts, entity timelines, and detection summaries.

## Technology Stack
- **Infrastructure:** Windows Server (Domain Controller), Windows 10/11 Clients
- **Log Collection:** Winlogbeat (Elastic)
- **Backend / API:** Python + FastAPI
- **Database:** PostgreSQL
- **Analytics & ML:** Python + Pandas + Scikit-Learn
- **Frontend:** React + TypeScript (Vite)

## Repository Structure
- `/docs/` - System architecture, detailed specifications, and academic research documentation.
- `/frontend/` - React + Vite UI dashboard for SOC alerts and investigation views.
- `/backend/` - FastAPI application handling log ingestion, normalization, and API endpoints.
- `/ML/` - Analytics components including the Rule Engine, Behavioral Engine (feature extraction, baseline models), and Risk Scorer.

## Group Members
- Million Birhanu (ID: 2210)
- Bereket Mamo (ID: 1513)
- Abraham Shimels (ID: 183)
- Bereketeab Sharew (ID: 2396)
- Eyosiyas Gezahegn (ID: 127)
- Amanuel Ayalew (ID: 4240)
- Samuel Alemu (ID: )

## Team Responsibilities
The project is modularly designed to support parallel development for a team of 7 students:
1. **AD Lab & Simulation:** Build the isolated virtual network and write traffic/attack simulation scripts.
2. **Collection & Ingestion:** Configure Winlogbeat and develop the FastAPI ingestion service.
3. **Data Schema & Storage:** Design the PostgreSQL relational schema and normalize raw logs.
4. **Rule Engine:** Write deterministic detection rules and severity weights.
5. **Behavioral Engine:** Implement feature extraction (Pandas) and baseline anomaly detection (Scikit-learn).
6. **Risk Scorer & API:** Correlate engine outputs and serve data via REST API to the frontend.
7. **Frontend UI:** Build the React dashboard and alert investigation visualizations.

## Getting Started
*(Further setup and deployment instructions for individual microservices can be found in their respective directories.)*
