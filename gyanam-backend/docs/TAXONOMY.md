# Taxonomy

This document defines the current `subject -> topic -> concept` hierarchy for the UPSC prelims knowledge base.

The source of truth for seeding subjects and topics is:

- [taxonomy.seed.json](/d:/Chanyakya/Chankya/gyanam-backend/prisma/taxonomy.seed.json)

The source of truth for seeded concepts is:

- [concepts.seed.json](/d:/Chanyakya/Chankya/gyanam-backend/prisma/concepts.seed.json)

Tagging rulebook and canonical concept mapping:

- [rulebook.v1.2.md](/d:/Chanyakya/Chankya/gyanam-backend/data/pyq/tagging/rulebook.v1.2.md)
- [concepts.master.v1.json](/d:/Chanyakya/Chankya/gyanam-backend/data/pyq/tagging/concepts.master.v1.json)

## Purpose

The hierarchy exists to make three layers explicit:

- `Subject`
  the broad exam bucket used for paper-level classification
- `Topic`
  the stable instructional grouping used for mastery, weak areas, and revision scheduling
- `Concept`
  the finest taggable knowledge unit used for question tagging and concept-performance analytics

## Current Subject Layer

The current broad subject labels are:

- `History`
- `Geography`
- `Polity`
- `Economy`
- `Environment`
- `Science & Technology`
- `Current Affairs`

These should remain the only paper-level subject labels unless the taxonomy is deliberately revised.

## Current Topic Layer

### History

- `Ancient India`
- `Medieval India`
- `Modern India`
- `Freedom Struggle`
- `Art & Culture`
- `Post-Independence India`

### Geography

- `Physical Geography`
- `Indian Geography`
- `World Geography`
- `Climatology`
- `Oceanography`
- `Economic Geography`

### Polity

- `Constitutional Foundations`
- `Fundamental Rights & Duties`
- `Parliament`
- `Executive & Judiciary`
- `Federal Structure`
- `Local Governance`
- `Constitutional Bodies & Institutions`

### Economy

- `Economic Fundamentals`
- `Monetary System`
- `Fiscal Policy`
- `Banking & Finance`
- `External Sector`
- `Agriculture & Rural Economy`
- `Infrastructure & Investment`

### Environment

- `Ecology & Biodiversity`
- `Climate Change`
- `Environmental Conventions`
- `Conservation & Protected Areas`
- `Pollution & Environmental Governance`

### Science & Technology

- `Space Technology`
- `Biotechnology`
- `Health Science`
- `Emerging Technologies`
- `Defence Technology`
- `Digital & Electronics`

### Current Affairs

- `International Relations`
- `Government Schemes & Policy`
- `Reports, Indices & Institutions`
- `Economy Current Affairs`
- `Environment Current Affairs`
- `Science & Tech Current Affairs`

## Current Concept Layer

Concepts are seeded separately and must always belong to:

- one subject
- one topic group within that subject

The Prisma seed now validates this. A concept seed with a subject/topic combination outside the taxonomy will fail the seed step.

## Schema Reality

The current schema stores:

- `Question.topicId`
- `Concept.subjectId`
- `Concept.topicGroup`
- `QuestionConcept(questionId, conceptId)`

So the hierarchy is operationally:

```text
Question
-> Topic
-> Subject

Question
-> QuestionConcept
-> Concept
-> Subject
-> topicGroup
```

This means the taxonomy is already usable, even though `Concept` does not yet have a direct foreign key to `Topic`.

## Current Design Rule

For now:

- question ingestion assigns `Topic`
- concept tagging assigns `Concept`
- concept seeds must use a `topicGroup` that matches a seeded topic name under the same subject

This gives us a stable hierarchy without a schema migration.

## Recommended Future Evolution

If concept graph work deepens, the next schema refinement should be:

- add `Concept.topicId`
- keep `topicGroup` only as a legacy/readability field or remove it after migration

That would make the graph stricter and reduce taxonomy drift.

Last updated: 2026-03-22

Last updated: 2026-03-22

