# Cyber DNA

## Development of an Intelligent Behavioral Analytics and Threat Detection Platform for Active Directory Environments

## 1. Project overview

Cyber DNA is a security monitoring and investigation platform focused on
activity in Windows and Active Directory environments. It collects
Windows security events, organizes them into a consistent format, checks
them for suspicious patterns, and presents the results in a web
dashboard.

The goal is to help an analyst understand more than whether an alert
exists. For each finding, the platform aims to explain **what happened,
why it matters, what evidence supports it, and what the analyst should
consider doing next**.

Cyber DNA is being developed as an academic project in a controlled lab
environment. Its main focus is identity-related activity, including
successful and failed logons, account activity, changes in privileges,
and other events that may indicate misuse or an attack.

## 2. Main objectives

-   Collect and process Windows event data from an Active Directory lab.
-   Normalize different event records so that they can be searched and
    analyzed consistently.
-   Detect suspicious activity using clear, traceable rules.
-   Correlate related events to provide more useful context than a
    single log record.
-   Present alerts, incidents, host information, and user behavior in
    one dashboard.
-   Explain findings in plain language and provide practical
    investigation guidance.
-   Provide a foundation for testing and comparing rule-based detection
    with behavioral or machine-learning approaches.

## 3. How the system works

The intended data flow is:

1.  **Event collection:** A collector reads selected Windows Event Logs
    from lab machines and forwards event records to the backend.
2.  **Ingestion and validation:** The API receives the records and
    checks that the incoming data has an acceptable structure.
3.  **Normalization:** The backend maps event data into consistent
    fields, such as timestamp, event ID, account, computer, source IP,
    result, and event details.
4.  **Storage:** Valid records are saved in the configured database so
    that they can be retrieved for analysis and displayed in the
    dashboard.
5.  **Detection:** Detection rules inspect event details and related
    activity for suspicious patterns.
6.  **Correlation and risk assessment:** Related evidence can be grouped
    or evaluated together to help prioritize investigation.
7.  **API and dashboard:** The frontend requests information from the
    backend and displays it through pages for monitoring and
    investigation.
8.  **Analyst explanation:** The analyst-facing features are intended to
    summarize the evidence, explain the possible meaning, and recommend
    next steps. Any explanation should be treated as guidance based on
    available evidence, not as automatic proof that an attack occurred.

The exact behavior depends on which services, collectors, and model
components are configured and running in a particular deployment.

## 4. Current platform features

The repository has been developed around the following areas.
Availability of a feature can depend on the current configuration and
whether its required service is running.

### 4.1 Dashboard and monitoring

-   A web dashboard for reviewing security activity.
-   Summary views for alerts, incidents, hosts, and user behavior.
-   API-backed data views rather than relying only on static
    demonstration data.
-   Health information for checking the status of backend services and
    integration components.

### 4.2 Windows event ingestion

-   An API endpoint for receiving collector events.
-   Backend validation and normalization of incoming records.
-   Support for important Windows event fields, including event
    timestamp, event ID, username, computer, source IP, logon type,
    result, and event details.
-   A pipeline designed to make received events available to detection
    logic and dashboard views.

### 4.3 Rule-based detection

The rule engine checks event data against explicit conditions. This
approach is useful because the logic can be inspected, tested, and
explained.

Examples of activity that can be investigated include:

-   Repeated failed logons that may indicate brute-force activity.
-   Successful logons that need to be considered alongside preceding
    failures or other context.
-   Account and privilege-related events.
-   Unusual combinations or sequences of security events.
-   Other patterns covered by the detection rules configured in the
    current version.

A match is a signal for investigation, not automatic confirmation of
malicious activity. Legitimate administration, user mistakes, and
lab-generated test events can also trigger rules.

### 4.4 Correlation and risk prioritization

Individual events often make more sense when reviewed together. The
backend includes logic for relating security events and producing
detection results that can be used to prioritize review.

The usefulness of a risk score depends on the evidence, rule
configuration, and scoring logic behind it. A score should not be
described as a measured probability of compromise unless it has been
calibrated and validated for that purpose.

### 4.5 Alerts and incidents

The dashboard includes dedicated alert and incident views intended to
help analysts:

-   Review suspicious findings.
-   Inspect the supporting event context.
-   Move from a summary to the relevant investigation view.
-   Separate individual event records from findings that may involve
    multiple events.
-   Track and review security activity in a more organized way.

### 4.6 Host and user behavior views

Host and user behavior pages help organize activity around the machine
or account involved. These views can support questions such as:

-   Which account or computer is involved?
-   What activity occurred around the time of the alert?
-   Were there related successful or failed logons?
-   Which events should be examined next?

The accuracy of these answers depends on the data collected and the
fields available in the records.

### 4.7 Analyst assistance and explanations

The analyst-facing functionality is intended to make findings easier to
understand by organizing the explanation around three questions:

-   **What happened?** A short description of the observed activity.
-   **How or why was it flagged?** The rule match, event evidence, or
    other available reason.
-   **What should be done next?** Practical investigation or response
    steps appropriate to the evidence.

Where available, analyst tools may also help prepare summaries or
investigation notes. Generated explanations should remain linked to the
actual event data and should not invent evidence, claim an action was
completed when it was not, or replace an analyst's judgment.

### 4.8 Authentication and onboarding

The backend contains authentication and onboarding components for
controlled access to the platform. The intended deployment model is that
accounts are provisioned or managed by an authorized administrator
rather than allowing unrestricted public registration.

Authentication configuration, administrator creation, and access rules
must be reviewed before deployment. Do not expose an initial
administrator-creation mechanism or development credentials to an
untrusted network.

### 4.9 Testing and verification

The repository includes automated tests and verification documents for
parts of the backend, detection logic, integration flow, authentication,
model inference, and frontend behavior.

Tests provide evidence for the specific paths they cover. They do not,
by themselves, prove that every feature works in every deployment.
Before a demonstration or submission, run the documented test suite and
confirm that the collector, database, API, frontend, and any optional
model service are configured correctly.

## 5. Detection approaches and academic evaluation

Cyber DNA is intended to provide a basis for examining two different
approaches to detection.

### Rule-based detection

Rule-based detection applies explicit conditions to events or event
sequences. Its strengths include transparency, repeatability, and
straightforward testing. Its limitations include the need to maintain
rules and the possibility of missing activity that does not match a
known pattern.

### Behavioral and machine-learning detection

Behavioral detection can examine features such as event frequency,
failed-login patterns, and changes in observed activity. A statistical
or machine-learning model may help identify activity that differs from
an established pattern.

This part of the project should be described according to the actual
model and runtime integration available in the submitted version. A
model file or training notebook alone does not mean that the model is
running in production. If model inference is not connected to the live
ingestion and detection pipeline, describe it as an experimental or
training component rather than an active detector.

### Evaluation plan

A fair comparison should use a controlled dataset with documented labels
or ground truth. Suitable measures include:

-   **Precision:** Of the events flagged, how many were actually
    suspicious?
-   **Recall:** Of the suspicious events present, how many were
    detected?
-   **F1-score:** A combined measure of precision and recall.
-   **False-positive rate:** How often normal activity is incorrectly
    flagged.
-   **Detection delay:** How long the system takes to produce a finding
    after the relevant activity occurs.

Results should state the dataset, test split, assumptions, and
limitations. Results measured on synthetic data should be labelled as
synthetic-data results and should not be presented as proof of
performance in a real enterprise network.

## 6. Technology stack

The repository is organized around these technologies:

-   **Backend:** Python and FastAPI.
-   **Frontend:** React and Vite.
-   **API communication:** HTTP/REST endpoints.
-   **Data processing:** Python-based validation, normalization, and
    detection logic.
-   **Storage:** A configured database accessed through the backend data
    layer.
-   **Model and analytics work:** Python-based model artifacts, feature
    processing, and training notebooks where included.
-   **Lab environment:** Windows machines and an Active Directory domain
    for collecting and generating test events.

Check the actual configuration files and deployment instructions before
naming a specific database engine, collector product, or model as a
required runtime dependency. The collector and model components can
differ between development environments.

## 7. Repository layout

The main folders and files are intended to serve these roles:

-   `backend/` --- FastAPI application, API endpoints, data handling,
    detection and correlation services, configuration, and backend
    tests.
-   `frontend/` --- React/Vite application, dashboard pages, reusable
    components, API client code, styles, and frontend tests.
-   `model/` --- Model-related artifacts, training material, or
    notebooks included with the submitted version.
-   `docs/` --- Architecture and supporting documentation, when present.
-   `README.md` --- Project introduction and setup information.
-   Other Markdown reports --- Implementation status, verification
    results, model notes, integration findings, and remaining work,
    where included.

The exact contents may change as the team integrates and verifies the
final submission.

## 8. Testing in a controlled lab

Testing should be carried out only in a domain and machines that the
team owns or is authorized to use.

A basic validation sequence is:

1.  Start the configured database and backend.
2.  Check the backend health endpoint.
3.  Confirm that the frontend can reach the backend API.
4.  Start the collector and verify that events are being sent.
5.  Confirm that ingested records appear in storage and in the
    dashboard.
6.  Generate benign test activity and controlled suspicious patterns in
    the isolated lab.
7.  Confirm that the expected rules or detections respond to the test
    events.
8.  Review the evidence and explanation shown for each finding.
9.  Run automated tests and record any known failures or limitations.

For repeatable experiments, record the test scenario, expected result,
actual result, and the event IDs or timestamps used to verify it. Avoid
testing against systems or accounts without permission.

## 9. Security and operational considerations

-   Keep the platform restricted to trusted users and networks.
-   Do not commit passwords, API keys, tokens, private event logs, or
    local environment files.
-   Use environment variables or a protected configuration mechanism for
    secrets.
-   Apply least-privilege access to the database and Windows event
    collector.
-   Protect sensitive account and host information displayed in the
    dashboard.
-   Validate incoming events and handle malformed data safely.
-   Keep dependencies updated and review authentication and
    authorization before deployment.
-   Treat alerts as evidence requiring investigation, not as conclusive
    proof of an attack.
-   Clearly label demonstration data, synthetic events, and experimental
    model output.
-   Back up data and document how to reset the lab between test runs.

## 10. Known limitations and areas for further work

The platform's effectiveness depends on event coverage, data quality,
configuration, and which components are connected in the deployed
environment. Potential areas for further work include:

-   Completing and documenting the collector-to-database pipeline for
    each supported lab setup.
-   Expanding and validating detection rules against a documented test
    set.
-   Verifying end-to-end model inference before presenting machine
    learning as an active detection feature.
-   Comparing rule-based and behavioral approaches with repeatable
    evaluation metrics.
-   Improving alert triage, evidence timelines, and investigation
    summaries.
-   Strengthening role-based authorization, audit logging, and
    production deployment controls.
-   Documenting deployment, recovery, and troubleshooting steps for new
    team members.

These items should be updated after the final integration tests so that
the repository accurately distinguishes completed features from planned
improvements.

## 11. Team members

-   Million Birhanu --- ID: 2210----Our Team leader 
-   Bereket Mamo --- ID: 1513 ------Our Model trainer
-   Abraham Shimels --- ID: 183 ----Our Backend Developer
-   Bereketeab Sharew --- ID: 2396 -Our Frontend Developer
-   Eyosiyas Gezahegn --- ID: 127  -Our Backend Developer
-   Amanuel Ayalew --- ID: 4240 ----Our Frontend Developer
-   Samuel Alemu --- ID: 3821 ------Our Model trainer


## 12. Project summary

Cyber DNA brings Windows and Active Directory event processing,
rule-based detection, event correlation, and analyst-focused dashboard
views into one platform. Its main contribution is to make
identity-related security activity easier to review and explain, while
providing a structured environment for testing detection logic and
exploring behavioral analytics.

The project should be assessed using the features that are actually
integrated and verified in the submitted version. Clear evidence, honest
reporting of limitations, and repeatable lab tests are essential to
evaluating its value.
