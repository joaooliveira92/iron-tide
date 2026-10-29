# ADR-0349: Ten playable nations roster

Consolidates: ADR-0205, ADR-0214

Applies to: content, campaign, desktop, ai, content-compiler, compiler-cli

Rule: The 1880 release has fourteen committed nations and ten playable nations, with the remaining four AI-only until each passes the per-nation readiness gate.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0205
Supersedes: ADR-0214

## Context

The 1880-release contract is ten playable nations. The RTW3 manual lists nine playable nations — Great Britain, Germany, France, Austria-Hungary, Russia, Italy, Japan, China, and Spain — against eight AI opponents (manual p.18). Bluewave tracks fourteen nations; the United States was initially marked playable and then demoted to AI-only by a lone `isPlayable` flag flip (commit `c86b1df`) to match the manual's nine. That demotion was a regression: the USA was already authored end to end — 1880 start, construction queue, fleet, economy, design identity, research programme, diplomacy, presentation, and renderer art.

The release gate `packages/ship-design/test/productionNationCoverage.test.ts` asserts `playable.length >= 10` ("1880 first release commits 14 nations (10 playable)") and was red at HEAD with nine playable. Repository evidence therefore contradicts the nine-nation roster. The manual is authoritative for mechanics and design intent, not for the scope of Bluewave's single 1880 start (ADR-0348), so promoting the USA is a deliberate, recorded divergence from manual p.18 rather than an error.

## Rules

1. **Ten playable nations.** The 1880 release has fourteen committed nations and ten playable nations: Great Britain, Germany, France, Austria-Hungary, Russia, Italy, Japan, China, Spain, and the United States. The remaining four nations are AI-only until each passes the per-nation readiness gate (start, queues, economy, design identity, research, diplomacy, geography-aware AI, presentation content, viability tests, plausibility review).
2. **Content flags.** `content/production/1880/countries.yaml` marks the USA `isPlayable: true`. The renderer playable-slot manifest (`PLAYABLE_SLOT_COUNTRY_IDS`) includes `us`.
3. **Release invariant.** The `>= 10` production coverage assertion is the intentional release invariant and must not be lowered to nine.
4. **Promotion is per nation.** The five (originally four) AI-only nations are promoted one at a time in the roster phase, each requiring its own readiness gate.
5. **Historical record.** ADR-0205 stays on disk as the historical record of the superseded nine-nation baseline.

## Consequences

- Ten playable, fourteen committed nations for the 1880 release.
- The production campaign snapshot and the content lock change because the USA slot flips from `ai` to `playable`; those hashes are re-pinned by the canonical workflow (`content:build` and the pinned snapshot test), never by hand.
- Documentation and tests must remain synchronized with the ten-nation contract: the manual baseline, requirements, roadmap, and the roster tests all state ten.
- Release validation for the ten requires validated historical-currency configurations unless a later decision waives it.