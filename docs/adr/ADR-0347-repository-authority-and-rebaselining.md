# ADR-0347: Repository authority order and unavailable-artifact policy

Consolidates: ADR-0210

Applies to: repository

Rule: Artifacts that never existed in reachable history are unverified legacy references; never recreate them from their filenames.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0210

## Context

The repository checkout is reduced. Many artifacts cited by the README, workflow prompts, historical plan, and code were never tracked in reachable history: `docs/PROGRESS.md`, `docs/OPEN-ISSUES.md`, `.ai/briefs/`, the `golden/hashes.json` baseline, a tree of legacy design documents, a rules tree, a domain tree, and about 121 referenced architecture decision records. Treating the reduced checkout as the complete baseline would either block every sprint or tempt the fabrication of canonical content.

A finite investigation (G-1) inspected `git log --all --full-history -- <path>`, `git rev-list --all --objects`, tags (none), dangling objects, historical versions of the roadmap and plan, CI configuration, and the generator scripts, and recorded the commands and object references. Full evidence is in `.ai/reports/g-1-artifact-inventory.md`; the classification and replacements are in `.ai/AUTHORITY-INDEX.md`.

## Rules

### 1. Unavailable-artifact policy

Artifacts confirmed never to have existed in reachable history are **unavailable and unverified legacy references**. They are registered with their citing document, investigation results, classification, past tracking status, purpose, replacement authority, reconstruction work, and effect on later sprints. They are never recreated from their filenames. Replacements take new identifiers and current dates, cite evidence, and separate confirmed behaviour from newly accepted design. Unavailable legacy files no longer block execution once they are registered.

### 2. Authority order

The authority order is:

1. Accepted decisions (the ADR corpus and this record).
2. The roadmap and sprint plan (`.ai/ROADMAP.md`, `.ai/SPRINT-PLAN.md`).
3. The RTW3 manual (`docs/Rule the Waves 3 Manual EBOOK.pdf`), except where a decision deliberately diverges.
4. Tests.
5. Production content.
6. Implementation (describes behaviour, not intent).
7. New cited research (`docs/research/`).

## Invariants

- An unavailable artifact must be registered with citing document, investigation, classification, purpose, replacement authority, reconstruction work, and sprint impact before execution may proceed past it.
- A replacement authority must carry a new identifier and current date and must separate confirmed behaviour from newly accepted design.
- The first deterministic golden baseline is created once the 1880 prerequisites in the plan are met; it is a new baseline, not a restoration.

## Compatibility

Replaces ADR-0210 with the same content condensed into the current consolidation format. No behavioural change.