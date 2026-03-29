# Security Overview

## Data Handling
- API keys and secrets stay in environment variables.
- No secrets are committed to git.
- PII handling must be explicit in API responses.

## Authentication
- JWT access + refresh flows in backend auth module.
- Access tokens validated on protected routes.

## Logging
- Avoid logging sensitive data.
- Use event logs for high‑level audit trails only.

## Risk Areas
- Third‑party API keys
- Data exports / datasets
- Admin endpoints

Last updated: 2026-03-29
