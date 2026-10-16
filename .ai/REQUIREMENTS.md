# Bluewave Requirement Index

Status: re-baselined 2026-10-15 by the G-1 sprint under ADR-0210 (DR-010).

This file gives stable requirement IDs derived from `README.md` without changing its
meaning. It distinguishes two trust classes:

- **Confirmed** — recovered from reachable history (`.ai/REQUIREMENTS.md` at commit
  `43177f4`, blob `55530625`). The normative statements below are as tracked; only the
  IDs and wording are carried forward.
- **Newly accepted (2026-10-15)** — derived from the accepted decisions DR-001..DR-011,
  now recorded as ADR-0201..ADR-0211.

The traceability records that once accompanied these IDs (status claims, test names,
and references to now-unavailable legacy ADRs) were never re-verified here. They are
unavailable and unverified legacy references (ADR-0210) and are not restored. Evidence
now lives in the named tests, the ADR corpus, and the gates.

## Confirmed requirements (recovered)

Architecture and authority

- **BW-ARC-001** — Domain and authoritative simulation logic remain independent of
  presentation and platform adapters.
- **BW-ARC-002** — UI state is never authoritative simulation state.
- **BW-STA-001** — Canonical, derived, cached, ledger, and ephemeral authority
  categories remain distinct.
- **BW-STA-002** — Every completed strategic month ends in a validated canonical
  snapshot.

Compiler and commands

- **BW-CMP-001** — Missing required canonical input causes campaign compilation failure.
- **BW-CMP-002** — Compiler output ordering and identifiers are canonicalized
  reproducibly.
- **BW-CMD-001** — Commands do not mutate authoritative state directly.
- **BW-CMD-002** — Commands pass through validation, reservation, locking, and explicit
  resolution outcomes.

Determinism

- **BW-DET-001** — Authoritative outcomes use integer or fixed-point arithmetic.
- **BW-DET-002** — A single global consumptive RNG stream is prohibited.
- **BW-DET-003** — Identical authoritative inputs produce identical hashes across
  supported operating systems.
- **BW-DET-004** — Random decisions use stable domain-separated keys and produce audit
  records.

Persistence

- **BW-PER-001** — Save files pin content, formula, AI, RNG, and format compatibility
  versions.
- **BW-PER-002** — Saves are committed atomically and retain a recovery state.
- **BW-PER-003** — Save/load preserves deterministic future outcomes.

Content rules

- **BW-RUL-001** — Localized text never controls simulation mechanics.
- **BW-RUL-002** — Authored normal events and content do not execute arbitrary scripts.

Testing

- **BW-TST-001** — Repeated campaign compilation is reproducible.
- **BW-TST-002** — UI navigation and reporting do not consume authoritative randomness.
- **BW-TST-003** — Replay reproduces authoritative results.

## Newly accepted requirements (2026-10-15)

- **BW-SCP-001** — 1880 is the sole start year and is production content (ADR-0201).
- **BW-SCP-002** — The authored horizon is 1939; 1960/1970 are out of scope, and no
  empty scenario ID is selectable (ADR-0204).
- **BW-SCP-003** — Ten manual-backed nations are playable for the deliberate
  1880-only release: the manual's nine plus the USA; the other four are AI-only
  behind a per-nation readiness gate (ADR-0214).
- **BW-PRS-001** — Canonical internal values are unit-agnostic; units and currency are
  presentation-only and never alter authoritative state (ADR-0202).
- **BW-PRS-002** — Preferences are a versioned, validated, migrated, atomically
  persisted domain with app, campaign, and session scopes (ADR-0203).
- **BW-PRS-003** — Currency display modes are Naval Credits, Budget Points, and
  National Historical only; the default is Naval Credits; there is no custom currency
  (ADR-0206..ADR-0208, ADR-0211).
- **BW-PRS-004** — UI language and formatting locale are separate concerns; strings are
  externalized and the en-US fallback is complete (ADR-0209).
- **BW-AUT-001** — Artifacts never tracked in reachable history are unavailable and
  unverified legacy references; replacements take new identifiers and the authority
  order in ADR-0210 governs (ADR-0210).

## Traceability

For every requirement, evidence is a named deterministic test, a documented gate, or a
recorded ADR. A requirement is not verified merely because code exists. The canonical
evidence path is: run `pnpm preflight`, `pnpm test:scripts`, and `pnpm check`, and cite
the test or gate in the change; see ADR-0210 for the authority order.
