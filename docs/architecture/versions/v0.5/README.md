# Architecture Version v0.5

Status: Draft  
Date: 2026-03-25
Version: v0.5

## 1. Executive Summary
This version captures the Experience Layer kickoff: mentor feedback messaging on attempt submission, built on top of the adaptive mentor engine v1.

## 2. Backend Core
- Adaptive mentor engine computes `systemAction` and weak areas.
- Assessment submission now emits mentor feedback messaging with verbosity variants and error-type hints.

## 3. API Architecture
- Attempt submission response includes `mentorFeedback` payload (headline, message, mode, focus, nextAction).

## 4. Client Architecture
- No change yet; UI integration pending.

## 5. Data Architecture
- Weak-area topic targeting remains derived from `question.topicId`.
- Mentor feedback enriches focus with topic labels from taxonomy (subject + topic name).
- No new persistence added.

## 6. Operational Architecture
- Mentor feedback is generated deterministically at submission time.
- No background jobs added.

## 7. Security Architecture
- No change from v0.4.

## 8. Changes Since Previous Version
- Added: Mentor feedback payload for post-attempt UX messaging.
- Added: Copy verbosity variants and error-type hinting in feedback text.
- Changed: Assessment service now synthesizes mentor feedback from user state.

## 9. Open Questions
- Should mentor feedback be logged as an event for analytics?
- Do we want per-topic display names in the API response?

Last updated: 2026-03-25

Last updated: 2026-03-25

Last updated: 2026-03-25
