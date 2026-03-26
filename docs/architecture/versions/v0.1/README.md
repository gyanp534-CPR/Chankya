# Chankya Architecture Blueprint v0.1

Status: Council Approved  
Date: 2026-03-03

## 1. Backend Core (The Brain)
- Runtime: Node.js
- Framework: Fastify (preferred) or Express
- Database: PostgreSQL (Neon or Supabase Postgres free tier initially)
- ORM: Prisma
- Authentication: JWT
- Cache: Redis (optional, phase 2)
- Hosting: Railway or Render initially

### Rationale
- Backend remains independent and portable.
- Avoids Firebase Firestore read-billing lock-in.
- Avoids unpredictable AI-first cost coupling.

## 2. API-First Design
All business logic lives in backend services. Clients consume the same API.

### Core Route Groups
- `/auth`
- `/users`
- `/subjects`
- `/topics`
- `/questions`
- `/tests`
- `/attempts`
- `/revision`
- `/analytics`
- `/war-room`
- `/subscriptions`

### Guarantees
- Feature parity across web and mobile.
- Clean boundaries.
- No duplicated domain logic.

## 3. Web Client
- Framework: Next.js 15
- Router: App Router
- UI: Tailwind + shadcn
- Type Safety: Strict TypeScript

### Priorities
- SEO for awareness.
- Fast dashboards.
- Deep analytics views.

## 4. Mobile Client
- Framework: React Native (Expo)
- Shared Models: TypeScript domain models shared with web/backend contracts
- API: Same backend API
- Firebase: Not used

### Priorities
- Daily practice
- Revision
- War-room participation
- Notifications

## 5. Data Architecture (Depth First)
### Learning Core
- Users
- UserProgress
- UserMetrics
- Subjects
- Topics
- Questions
- TestSets
- TestAttempts
- AttemptResponses
- RevisionSchedule
- WeakAreaMap
- MasteryIndexHistory

### Engagement
- WarRoomEvents
- WarRoomParticipation

### Monetization
- Subscriptions
- Plans

### Constitutional Separation
War-room and Monetization are separate from Mastery/Learning tables to preserve independence of core academic state.

## Versioned File Map
- [Stack and Runtime](./stack-and-runtime.md)
- [API Architecture](./api-architecture.md)
- [Data Model](./data-architecture.md)
- [Deployment Blueprint](./deployment.md)
- [Open Questions for v0.2](./open-questions-v0.2.md)

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

