# PYQ Tagging System

This document captures the tagging schema, rulebook, and outputs for UPSC PYQ concept tagging.

## Scope

The tagging system covers:
- GS Paper 1
- CSAT Paper 2

The goal is to capture:
- **what** is tested (primary_concept)
- **how** it is solved (question_intent, reasoning_type)
- **how hard** it is (cognitive_level)
- **why students fail** (error_prone_area)

## Source Files

Primary tagging datasets:
- `data/pyq/tagging/seed-master.csv`
- `data/pyq/tagging/seed-master.core.v1.csv` (CORE-only)

Audit subset for manual calibration:
- `data/pyq/tagging/audit-50.csv`
- `data/pyq/tagging/audit-50.core.v1.csv`

Rulebook:
- `data/pyq/tagging/rulebook.v1.2.md`

Canonical concept mapping:
- `data/pyq/tagging/concepts.master.v1.json`
- `data/pyq/tagging/concepts.priority.v1.json`

Core/advanced schema split:
- `data/pyq/tagging/schema.core.v1.json`
- `data/pyq/tagging/schema.advanced.v1.json`

## Schema (Current)

### Core Fields (must fill)
- `primary_concept`
- `question_intent`
- `cognitive_level`

### Intelligence Fields (optional / internal)
- `reasoning_type`
- `trap_type`
- `secondary_subject`

### Meta Fields
- `error_prone_area`
- `confidence_level`
- `trend_tag` (computed only)

Failure taxonomy:
- `data/pyq/tagging/failure-taxonomy.v1.md`

## Trend Tag (Derived)

`trend_tag` is computed from historical coverage:
- `Repeating`: appears in 3+ distinct years
- `Emerging`: appears only in the latest 2 years
- `Declining`: appears only in the earliest years

No manual tagging is used for this field.

## Graph Outputs

Computed intelligence outputs:
- `data/pyq/tagging/concepts.final.v1.csv` (top concepts)
- `data/pyq/tagging/concepts.cluster.v1.csv`
- `data/pyq/tagging/concepts.nodes.v1.csv`
- `data/pyq/tagging/concepts.edges.v1.csv`
- `data/pyq/tagging/concepts.stats.v1.csv`

These are used for graph generation and analytics.

## Manual Calibration

Manual calibration is done on the audit set before system-wide rollout.
Only the audit file should be edited manually during calibration.

Last updated: 2026-03-22

Last updated: 2026-03-22

