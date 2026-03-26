# Data Architecture - v0.1

## Core Domains

### Identity and Performance
- `Users`
- `UserProgress`
- `UserMetrics`
- `MasteryIndexHistory`

### Curriculum
- `Subjects`
- `Topics`
- `Questions`

### Testing
- `TestSets`
- `TestAttempts`
- `AttemptResponses`

### Revision Intelligence
- `RevisionSchedule`
- `WeakAreaMap`

### Engagement (Separate Domain)
- `WarRoomEvents`
- `WarRoomParticipation`

### Monetization (Separate Domain)
- `Plans`
- `Subscriptions`

## Separation Rules
- Learning/mastery tables are independent from monetization tables.
- War-room behavior does not directly mutate mastery records.
- Cross-domain joins should happen at service/application boundaries, not through tightly coupled table design.

## Planned v0.2 Extensions
- Soft delete and audit fields.
- Versioned question content.
- Event outbox for analytics and notifications.

Last updated: 2026-03-22

Last updated: 2026-03-22

Last updated: 2026-03-22

