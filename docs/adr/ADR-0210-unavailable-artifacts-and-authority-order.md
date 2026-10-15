# ADR-0210: Unavailable artifacts are unverified legacy references; authority order

## Status

Accepted (2026-10-15). New record of decision DR-010; no prior ADR file existed for
it and none is restored. This record also governs the artifact re-baselining performed
in the G-1 sprint and is the authority for `.ai/AUTHORITY-INDEX.md`.

## Context

This checkout is reduced. `pnpm preflight` is green, but many artifacts cited by the
README, the workflow prompts, the historical plan, and the code were never tracked in
this repository's reachable history: `docs/PROGRESS.md`, `docs/OPEN-ISSUES.md`,
`.ai/briefs/`, the `golden/hashes.json` baseline, a tree of legacy design documents, a
rules tree, a domain tree, and about 121 referenced architecture decision records. Treating the reduced checkout as the complete baseline would either
block every sprint or tempt the fabrication of canonical content.

A finite investigation (G-1) inspected `git log --all --full-history -- <path>`,
`git rev-list --all --objects`, tags (none), dangling objects, historical versions of
the roadmap and plan, CI configuration, and the generator scripts, and recorded the
commands and object references. Full evidence is in
`.ai/reports/g-1-artifact-inventory.md`; the classification and replacements are in
`.ai/AUTHORITY-INDEX.md`.

## Decision

Artifacts confirmed never to have existed in reachable history are **unavailable and
unverified legacy references**. They are registered with their citing document, the
investigation, their classification, whether they were ever tracked, their purpose,
a replacement authority, the reconstruction work, and their effect on later sprints.
They are never recreated from their filenames. Replacements take new identifiers and
current dates, cite evidence, and separate confirmed behaviour from newly accepted
design. Unavailable legacy files no longer block execution once they are registered.

The authority order is:

1. Accepted decisions (the ADR corpus and this record).
2. The roadmap and sprint plan (`.ai/ROADMAP.md`, `.ai/SPRINT-PLAN.md`).
3. The RTW3 manual (`docs/Rule the Waves 3 Manual EBOOK.pdf`), except where a
   decision deliberately diverges.
4. Tests.
5. Production content.
6. Implementation (describes behaviour, not intent).
7. New cited research (`docs/research/`).

## Consequences

- A later sprint may cite a registered replacement authority, never an unavailable path.
- The first deterministic golden baseline is created only once the 1880 prerequisites
  in the plan are met; it is a new baseline, not a restoration.
- Reconstructed documents carry a new identifier and date and mark confirmed evidence
  apart from new design.
- The `.scratch/` tracker is restored only if a tracked authoritative document depends
  on it; no such dependency exists, so it is not restored.
