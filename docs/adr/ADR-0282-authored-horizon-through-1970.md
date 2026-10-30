# ADR-0282: Authored horizon through 1970; no empty scenario IDs

Applies to: content, campaign, cross-process-test

## Status

Superseded by: ADR-0348

Accepted (2026-10-23).
Supersedes: ADR-0204.

It replaces ADR-0204 on the horizon; its scenario-ID rule is restated
here and stands. Owner decision of 2026-10-23, delivered by spec
[#249](https://github.com/joaooliveira92/iron-tide/issues/249) (ticket [#250](https://github.com/joaooliveira92/iron-tide/issues/250)).

## Context

The campaign calendar and the S-2 career end already run to December 1970 ([ADR-0281](ADR-0281-sacking-phase-and-terminal-career.md)), but
authored content stopped at 1939. A player who survives would play about thirty years with no new technology, ships or parts.

## Decision

1. **Horizon.** The authored horizon is 1970. Technology, ship-building and part content is authored for 1940 to 1970, in decade
   slices (1940-1949, 1950-1959, 1960-1970). The sole start stays 1880 ([ADR-0201](ADR-0201-sole-1880-start.md)).
2. **In scope**, as the manual supports them (pp.121-128): radar-era sensors and fire control, guided missiles, jet aircraft,
   carriers and naval aviation, and the postwar ship types of the period.
3. **Out of scope.** Nuclear weapons, unless a later owner decision adds them. Postwar political events, goal-directed AI (A-1) and
   scenarios other than 1880.
4. **Research first.** Every date, class and value traces to the manual or another cited source in a research dossier. A value no
   source gives returns to the owner individually by decision request; none is invented or placeholdered (precedent
   [ADR-0239](ADR-0239-s2-prestige-values-balance-targets.md)).
5. **Honest content.** A technology whose effect the engine cannot model is audited and marked inert; content never promises
   behaviour the engine lacks. Engine gaps become separate tickets, not part of content slices.
6. **Scenario IDs.** Declared scenario IDs with no content pack stay non-selectable rather than appearing as empty choices.
7. **Goldens.** Each content slice re-pins the goldens once, with old and new values and cause, per `docs/agents/golden-repinning.md`.

## Consequences

- BW-SCP-002, the README, the sprint plan content row, R-1 and the RTW3 baseline note state 1970.
- Nothing in this ADR changes content, code or goldens; it gates the content tickets of spec #249.
