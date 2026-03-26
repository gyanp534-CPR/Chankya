# UPSC Tagging Rulebook v1.2

This version incorporates the council changes: inference logic, partial correctness trap, error-prone area, confidence level, and trend tags as computed fields.

## Core Fields (Mandatory)
- `primary_concept`
- `question_intent`
- `cognitive_level`

## Intelligence Fields (Optional / Advanced)
- `reasoning_type`
- `trap_type`
- `secondary_subject`

## Meta Fields
- `error_prone_area`
- `confidence_level`
- `trend_tag` (computed, not manually tagged)

---

## Release Split (CORE vs ADVANCED)
For first-release simplicity, only CORE fields are exposed publicly. ADVANCED and META fields remain internal.

- CORE schema: `schema.core.v1.json`
- ADVANCED schema: `schema.advanced.v1.json`
- CORE-only exports:
  - `seed-master.core.v1.csv`
  - `audit-50.core.v1.csv`

---

## A) GS1 Question Intent
- Direct definition/identification: `Fact Recall`
- Statement-based multi-check: `Elimination Logic`
- Conceptual application: `Concept Application`

## B) CSAT Reasoning Depth (`reasoning_type`)
- RC (passage_id present): `Reading Interpretation`
- Logical sets / constraints:
  - Pure deduction: `Logical Deduction`
  - Option-driven elimination: `Constraint Satisfaction`
  - Inference from short statements: `Inference Logic`
- Optimization / multi-step strategy: `Numerical Optimization`
- Quant formula only: leave blank

## C) Trap Type (`trap_type`)
- Statement-based 2+ statements: `Statement Distortion`
- Very close factual options: `Fact Twist`
- Adjacent concept confusion: `Concept Confusion`
- Absolute/extreme qualifiers: `Extreme Statement`
- Almost-correct option mixed with one wrong clause: `Partial Correctness Trap`
- Otherwise: `None`

## D) Secondary Subject (`secondary_subject`)
Only fill when confidence is high. Otherwise leave blank.
- Economy + Environment â†’ secondary = Environment
- Polity + Governance â†’ secondary = Governance
- History + Culture â†’ secondary = Culture
- Environment + Economy â†’ secondary = Economy

## E) Error-Prone Area (`error_prone_area`)
Use the failure taxonomy:

- `Concept Confusion`
- `Statement Distortion`
- `Partial Correctness Trap`
- `Surface Matching`
- `Overthinking`
- `Unstructured Approach`
- `Misreading`
- `Calculation Error`
- `Step Skipping`
- `Incomplete Inference`
- `Time Pressure Guessing`
- `Knowledge Gap`

## F) Confidence Level (`confidence_level`)
- `High`: clear and unambiguous
- `Medium`: some ambiguity
- `Low`: borderline / unsure

## G) Trend Tag (`trend_tag`)
Derived field. Compute from historical frequency:
- `Repeating`: appears in 3+ distinct years
- `Emerging`: appears only in latest 2 years
- `Declining`: appears only in early years and not recent

Last updated: 2026-03-22

Last updated: 2026-03-22

