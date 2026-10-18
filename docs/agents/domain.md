# Domain model

The engine is a directed package graph (see `packages/README.md`). Domain logic
is independent of presentation and platform adapters (BW-ARC-001); UI state is
never authoritative (BW-ARC-002).

## Authority categories

State is split into five categories that must stay distinct (BW-STA-001):

- **canonical** — the authoritative snapshot the month commits to;
- **derived** — recomputed read-only projections (screen view models);
- **cached** — recomputable accelerators, never a source of truth;
- **ledger** — append-only audit records (RNG, commands, events);
- **ephemeral** — UI-only state, never read by the month executor.

## Core aggregates

- **Campaign** — world, nations, areas, ports, routes, fleets, research, war.
- **Nation** — a date-banded naval profile, budget, dockyards, and doctrine.
- **Fleet / division** — ships and officers grouped on the map.
- **Ship design** — a component-level draft compiled into a validated design;
  construction projects and rebuilds apply it over time.
- **War** — score and classification accumulated from resolved battles.

## How a month flows

A **command** (never a direct mutation) is validated, reserved, locked, and
resolved into explicit outcomes (BW-CMD-001/002). Ordered **phases** run the
monthly turn, each with a declared read/write footprint and whether it may draw
randomness. Phases emit **domain events**, and the month closes into a validated
canonical snapshot (BW-STA-002). Randomness is domain-separated and recorded on a
ledger (BW-DET-004).

## Boundaries

Every external input — compiled YAML, saves, IPC/event envelopes, files — is
decoded with a strict Effect Schema before use. Localized text never controls
mechanics (BW-RUL-001); authored content never executes arbitrary scripts
(BW-RUL-002). See [canonical content and rulesets](../architecture/canonical-content-and-rulesets.md)
and [non-negotiable rules](../architecture/non-negotiable-rules.md).

## How the engineering skills consume domain docs

Multi-context: the root `GLOSSARY-MAP.md` points at one `GLOSSARY.md`
per context; the root `GLOSSARY.md` symlinks `CONTEXT.md`.

- Read `GLOSSARY-MAP.md` if present, else `CONTEXT.md`; also the relevant
  `packages/<context>/GLOSSARY.md`.
- Read `docs/adr/` for decisions touching the area; context-scoped ones live in
  `packages/<context>/docs/adr/`.
- If absent, proceed silently — don't flag it.
- Use glossary vocabulary; surface ADR contradictions rather than overriding silently.
