# D7: Gating, authority, and dependencies

**Type:** grilling · **Status:** resolved

## Question

What authority governs U-2, what does it depend on, is it gated, and does it
introduce any stop condition or decision request?

## Answer

**Authority.** ADR-0203 (preferences architecture) governs the domain; ADR-0202
(canonical values, presentation-only) governs the constraint; ADR-0209 (language
vs locale), ADR-0206/0207/0208/0211 (currency display modes, default, requested
vs effective) govern the specific settings. The manual is authority 3 and grounds
only the measurement default (p.18) and the save/realism/tactical options it
names; the settings taxonomy is Bluewave design (research note §5). Authority
order per ADR-0210.

**Dependencies.** U-2 consumes U-1's canonical representation (the value-preserving
tickets have landed: the canonical units module and branded money exist in
`packages/contracts`). U-2 stores **presentation preferences only** and adds no
authoritative value, so it does not depend on U-1's outcome-moving tickets (the
float→fixed conversions) and moves no golden hash.

**Golden-neutral.** U-2 must leave `golden/hashes.json` and the production
campaign-snapshot hashes unchanged: preferences live in an app-scope file and
campaign sidecars, never in the hashed save snapshot. The acceptance ticket proves
the invariance.

**No gate.** Unlike S-1 (required per-ship state) and U-1 tickets 06–08
(snapshot-moving conversions), U-2 changes no authoritative outcome, so no open
decision request blocks it and no golden re-pin is required. Decision requests
0005/0006/0007 concern other sprints and do not gate U-2.

**No new decision request.** The manual's silence on the whole settings-screen
taxonomy, theme, text-scale, reduced-motion, tooltip-detail, number-scale, locale,
and currency-display setting is already covered by accepted ADRs (ADR-0203/0202/
0209/0211) — a documented boundary, not an open decision. The autosave-cadence and
report/map/auto-pause enumerations the manual leaves undefined belong to F-4 and
T-2, not U-2, and are recorded as out of scope rather than resolved here.

**Stop condition.** If implementing a setting would require changing an
authoritative value, a golden hash, a save format, or a wire format, **stop** and
raise a decision request rather than resolving it in U-2.

## Why

Determinism and replacement-cost decisions must not be made silently (AGENTS.md
Stop conditions; contract §ADR threshold). Recording that U-2 is authority-bound,
dependable on U-1's structural tickets, golden-neutral, and un-gated keeps the way
to implementation unambiguous and stops it from drifting into U-3/U-4/U-5 or into
gameplay.
