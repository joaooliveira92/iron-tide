# 07: Seed 1880 divisions and de-duplicate the officer roster

**What to build:** Give the 1880 scenario a real command structure. Every nation
starts with `0` divisions and exactly `6` uniformly-shaped officers (e.g. every
nation has 3 CAPTAIN, 2 COMMODORE, 1 REAR_ADMIRAL with no nation-specific
identity), which reads as placeholder generation. Seed initial divisions for the
nations that had one and make officer rosters nation-appropriate and distinct.

**Blocked by:** None.

**Status:** done (2026-10-17). Both halves landed under ADR-0224:

- Per-nation officer rosters: commit `94aee73` (same-commit golden re-pin;
  `closingSnapshotHash` and `replayVerificationHash` moved with recorded
  old/new values).
- Seeded 1880 divisions: an authored `divisions` collection
  (`content/production/1880/divisions.yaml`, declared in `pack.json`) threaded
  through the content compiler and campaign compiler
  (`packages/campaign/src/divisions.ts`, `nationCompilation.ts`). The
  cross-process reference run is **golden-neutral** (its in-code fixture
  declares no divisions collection, so `NationState.divisions` stays `[]`
  exactly as before); only the authored content and the committed content lock
  moved. The commit carries `Golden-Repin: not-needed` with that reason.
  `NationState.divisions` is an existing required field populated at compile, so
  no compatibility bump or migration is required.

- [x] Initial divisions are seeded for nations that had them in 1880 (uk,
      france, germany, russia, austria_hungary, italy, japan, ottoman_empire,
      spain, netherlands, portugal, brazil); `usa` and `qing` are documented as
      having no organised division (their 1880 squadrons were single ships still
      working up) — see the `divisions.yaml` header.
- [x] Officer rosters differ per nation and are not a uniform template (`officers.test.ts`).
- [x] A deterministic test asserts the seeded division structure loads from the
      snapshot and satisfies `assertDivisionInvariants`
      (`packages/cross-process-test/test/seeded-divisions.test.ts`), plus the
      compile-boundary resolver tests (`packages/campaign/test/division.test.ts`)
      and the authored-collection test
      (`packages/content-compiler/test/initialDivisions.test.ts`).
- [x] The `NationState` compatibility impact is assessed: divisions is an
      existing required field, so no bump/migration is required.

Completing this ticket finishes N-1 (the 1880 scenario audit); N-2 (1880 content
completion) and N-3 (1880–1890 progression) become reachable. They are large
separate sprints and are **not** started here.
