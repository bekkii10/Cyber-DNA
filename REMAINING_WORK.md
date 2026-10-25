# Remaining Work / Known Limitations

1. **Backend authentication and authorization are not implemented.**
   The supplied project has no backend identity middleware. The frontend login is intentionally labeled a demo gate. Do not expose this build to an untrusted network until real administrator-created accounts, session/token validation, role checks, and authorization are implemented.

2. **Collector feature mapping remains a compatibility assumption.**
   The supplied training notebook verifies the v25 preprocessing/scoring artifact but explicitly leaves collector feature mapping validation outstanding. A real collector-to-training-data mapping validation is still required before claiming production model validity.

3. **Frontend build and browser tests were not executed in this environment.**
   `npm install` did not complete within the available execution window, leaving Vite unavailable. Run the frontend commands in `RUN_KALI.md` on Kali and record the results before claiming UI build/test completion.

4. **External AI provider connectivity was not tested.**
   No provider credential was supplied. The deterministic fallback is used when the provider is unavailable.

5. **Investigation report persistence/export is not a new backend workflow in this build.**
   The advanced notebook/assistant can preserve analyst material in the existing frontend notebook and export mechanisms, but a new server-side persisted investigation-report database workflow was not invented without a supplied schema/authorization model.
