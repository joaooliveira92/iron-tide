# ADR-0205: Nine playable nations; the rest AI-only behind a readiness gate

## Status

Accepted (2026-10-15). New record of decision DR-005; no prior ADR file existed for
it and none is restored (see ADR-0210).

## Context

The manual lists nine playable nations — Great Britain, Germany, France,
Austria-Hungary, Russia, Italy, Japan, China, and Spain — against eight AI opponents
(manual p.18). Bluewave tracks fourteen nations; the USA is currently marked playable
and must be demoted.

## Decision

Nine nations are playable, matching the manual. The other five are AI-only until each
passes a per-nation readiness gate (start, queues, economy, design identity, research,
diplomacy, geography-aware AI, presentation content, viability tests, plausibility
review). Promotion is per nation and independent.

## Consequences

- The scenario clean-up sprint (G-3) demotes the USA and verifies the nine-nation
  roster by test.
- Release validation for the nine requires validated historical-currency
  configurations unless a later decision waives it (ADR-0211).
- The five AI-only nations are promoted one at a time in the roster phase.
