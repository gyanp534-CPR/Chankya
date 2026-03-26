# API Architecture - v0.1

## API-First Contract
All business logic lives in backend APIs. Web and mobile are consumers only.

## Route Domains
- `/auth`: registration, login, token refresh, logout
- `/users`: profile, settings, account state
- `/subjects`: subject taxonomy
- `/topics`: topic hierarchy and metadata
- `/questions`: question bank and metadata
- `/tests`: test set definition and retrieval
- `/attempts`: test attempt submission and scoring events
- `/revision`: spaced revision schedule and weak area queues
- `/analytics`: user metrics and trend endpoints
- `/war-room`: real-time event state and participation
- `/subscriptions`: plan state and entitlement access

## Constraints
- Business rules must not live in UI clients.
- Endpoint behavior should be consistent for web and mobile.
- Shared response shape and error contract to be finalized in v0.2.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

