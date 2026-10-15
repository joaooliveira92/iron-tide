# Comment pruning plan (fresh run)

Analysis only. No comment was deleted and no code was edited. This is a proposal
for PR-sized work on a short-lived branch, never on `dev` (ADR-0165).

## How this was produced

A `comment-pruner` run: `poteto-mode` discipline, a `swarm` of 9 read-only workers
partitioned across the authored tree, each applying the `no-comments` rubric.
Slices: combat/src; combat/test; renderer/screens; renderer/components;
desktop main+shell+lib+shared+preload; ship-design+ship-visual+armament;
phase-engine+campaign+campaign-engine+commands;
content-schema+content-compiler+content-codemod+cross-process-test+persistence+ai+
small packages; compiler-cli+desktop test/e2e+scripts. Excluded `vendor/**`,
`repos/**`, `**/dist/**`, `**/node_modules/**`, `**/.turbo/**`,
`content/generated/**`.

The orchestrator re-read the highest-value claims directly. One worker claim was
falsified and dropped (see "Corrections").

## Headline facts (measured on this tree at HEAD `3e37b6c`)

- **8** self-path file headers remain (down from 477 before the earlier sweep).
- **432** banner/ruler separator lines (`// ----`).
- **48** JSX narration comments (`{/* ... */}`).
- **21** suppressions total: **8** `@ts-expect-error`, **13** `eslint-disable`;
  zero `@ts-ignore` and zero `oxlint-disable`.
- **31** source files contain `as unknown as` (excluding tests).
- **46** source files call `localeCompare`, which the repo's own determinism rule
  forbids in canonical ordering.
- **18** `TODO #N` markers; comment culture is strong (1073 files cite
  `DESIGN-*`/`ADR-*`/`BW-*`/`SPM-*`/`SB3-*`/`CAH-*`/`INC-*`/`IMP-*`). Those are
  load-bearing and stay.
- Workers sampled the densest files, so DELETE figures are lower bounds and
  bucket totals are estimates, not a census.

## Bucket 1 - Delete outright

Mechanical noise. No behavior change. One codemod covers most of it.

1. **Banner/ruler separators (432 lines).** `// ---- Vocabulary ----`,
   `// Stage 1 - ...`, `// --- legacy-compatibility drift ---`, and the
   `---- embedded self-test fixtures ----` family repeated across ~15 gate
   scripts. The section label is either the next type name, the following JSDoc,
   or an already-named function. Concentrations: `armament/src/resolver.ts` and
   `lint.ts`, `content-schema/src/nation.ts`, `phase-engine/src/research.ts` and
   `foreignWarEffects.ts`, `campaign/src/index.ts`.
2. **JSX narration (48 sites).** `{/* Chrome: the ruler readout. */}`,
   `{/* Scrim */}`, `{/* Row 1: primary header */}`, `{/* Globe viewport */}`,
   `{/*<StatusBar />*/}` plus the JSDoc still listing `StatusBar`. The element
   class, `data-testid`, or the removed symbol's absence already says this.
3. **Remaining self-path file headers (8).** e.g.
   `packages/combat/src/submarines/contracts/core.ts:1` (and its two siblings,
   all wrongly tagged `contracts.ts`), `packages/ai/test/ai.test.ts:1`,
   `packages/combat/test/tatical-design.test.ts:1` (stale filename).
4. **Name-only JSDoc.** Prop/field docs that only restate the name or type:
   `useMapCamera.ts:59-120`, `liquid-glass.tsx:127-138`, most `panels/**` prop
   blocks, `content-schema/src/ship-parts.ts` field docs, `combat/src/damage/pipeline.ts:55-79`.
   Keep docs that add a unit, bound, or rule (`Bore diameter, micrometres.`,
   `0..10000`, `basis points`).
5. **Phase/step narration in long functions.** `// Stage N:`, `// Step 1: ...`,
   `// Phase 7: <name>` where a stage id or the next call names it. Clusters:
   `combat/src/generation/pipeline.ts`, `simulation/minuteStages.ts`,
   `ship-design/src/compile.ts` and `partFit.ts`, `phase-engine/src/research.ts`,
   `commandLifecycle.ts`. Keep the ones carrying a `DESIGN-*` ordering reason.
6. **Test narration and scratchpads.** `// arrange`, `// Verify world state`,
   `// Page 1 -> 2`, `// expected` on empty `catch {}`. Worse, several tests keep
   the author's mid-derivation scratchpad (`// wait`, `// Hmm, this is complex.`,
   `// Actually: numerator = ...`) in `combat/test/smoke/funnel-smoke.test.ts`,
   `damage/protection-interaction.test.ts`, `air-combat/*`, `weather/visibility.test.ts`.
   Replace the empty-catch `// expected` with a real throw assertion (see Bucket 2).
7. **Duplicated prose across siblings.** The `PROTOTYPE - throwaway` header
   copied across 6 `world-map/*` files; the three-way "Storage unavailable"
   rationale (`FindingsControl.tsx`, `shared/panel-memory.ts`, `useSplitWidth.ts`);
   `Datum offsets, px.` in two hull-plan files. Keep one canonical copy.
8. **Stale `TODO #N` tags.** `persistence/src/*` cites `TODO #1..#14` that the
   `remediation.test.ts` suite shows are already implemented. Keep the rationale
   wording, drop the dead ticket stubs. Confirm the tickets are closed first.

## Bucket 2 - Refactor first (the comment is a symptom)

Ranked by value. The comment disappears when the cause is fixed.

1. **`localeCompare` in authoritative ordering (highest value, and the riskiest).**
   The determinism rule forbids host-locale string comparison in canonical
   ordering, and `@bluewave/deterministic` exports `compareCodePoints` for exactly
   this. Yet 46 source files call `localeCompare`. Many are display-only renderer
   sorts and are fine. The concern is the ones feeding hashes and canonical
   artifacts, for example `packages/combat/src/generation/manifest.ts:82` inside
   `canonicalizeManifest` (the manifest hash input), `packages/combat/src/generation/*`
   ordering siblings, `packages/campaign/src/{world,nation,political}Compilation.ts`,
   `packages/campaign-engine/src/{fleet,world-map,diplomacy,projection}.ts`, and
   `packages/persistence/src/store.ts:645`. Fix: replace with `compareCodePoints`
   where the order is authoritative; leave display sorts alone. See Stop
   conditions: this can move a golden hash and needs an understood cause.
2. **React unstable-dependency suppressions (8 sites, confirmed).**
   `useWorldMapModel.ts:156,165,212`, `useInitialFocusArea.ts:27`,
   `FindingList.tsx:53`, `useSvgGlobe.ts:262`, `InteractiveGlobe.tsx:238,268`.
   The effects read per-render values through stable ref bundles, so the dep array
   lies. Fix: pass the actually-read values (or memoized callbacks) so deps are
   honest, then delete the `exhaustive-deps` disable. Renderer change: run
   `pnpm test:e2e` and `pnpm snap`.
3. **`as unknown as` boundary casts (31 source files).** Each is a boundary that
   was asserted instead of decoded, contrary to the AGENTS.md rule. Concentrations:
   `ship-design/src/persistence.ts:163,258`, `componentVariants.ts:82`;
   `desktop/src/main/{monthInput,pendingCommands}.ts` ("accepted narrowing
   INC-3"), `designCommands.ts` (repeated `as unknown as DesignDraft`);
   `phase-engine/src/battles.ts:223`, `tacticalReplay.ts:78`, `carrier-operations.ts`;
   `compiler-cli/src/commands.ts:1663-1682` (Map vs record snapshot);
   `persistence/src/store.ts:464`, `saveMigration.ts:223` (`JSON.parse(...) as`).
   Fix: model the real input union or decode with the Effect Schema once and carry
   the typed value. Each removal also shrinks the `no-unknown-casts` baseline.
4. **Stale prototype framing.** 6 `world-map/*` files open with
   `PROTOTYPE - throwaway. See ./README.md.` The module is the production Overview
   map and the referenced `world-map/README.md` does not exist. Fix: drop the
   caveat and retitle. Separately, `map-prototype/*` (6 files) is a live
   dev-only prototype whose README does exist; decide to delete the prototype (its
   ticket 06) or promote it, rather than leaving "throwaway" headers forever.
5. **`for now` / placeholder shims kept alive by comment.**
   `renderer/shell/controller/mechanicalAcoustic.ts` (no-op until audio assets
   exist), `renderer/shell/strategic-destination.ts:12` (unvalidated `focus*`),
   `main/commands/designCommands.ts` (refit lens "not yet plumbed"),
   `campaign-engine/src/{construction,projection,fleet}.ts` (proxies for missing
   authored content). Fix: land the capability or delete the call sites; do not
   keep the comment.
6. **Suppressions that hide a typable gap.** `phase-engine/src/snapshotClone.ts:98,115`
   (`@typescript-eslint/no-explicit-any`, though the comment justifies it) can be
   typed via a TypedArray-constructor map and `Reflect.ownKeys`.
   `combat/test/air-defense/*` `@ts-expect-error testing invalid X` fight factories
   typed to the validated output; expose an `unknown`-input decode seam instead.
   `compiler-cli/test/combatDiagnostics.test.ts:93` and `e2e/fixtures.ts:110` are
   test-only suppressions with a small seam fix.
7. **Empty `catch {}` plus `// expected` (3 tests).** The test only asserts
   non-mutation, so a silent non-throw passes. Fix: `expect(...).toThrow()`, which
   also removes the marker.
8. **Pipeline order encoded twice.** `ship-design/src/compile.ts` numbered stages
   duplicate `compileStages.ts` banners, and `partFit.ts` repeats them again; the
   banners even emit out of numeric order, proving they are not authoritative.
   Fix: one ordered stage registry consumed by callers. Largest effort here.
9. **Duplicated private helpers** (`clamp`, `arrayEquals`, `floorDiv` across ~8
   files) whose restating docs vanish once shared.

## Bucket 3 - Keep (do not prune)

- Canonical and domain rationale: `DESIGN-*`, `ADR-*`, `BW-*`, `SPM-*`, `SB3-*`,
  `CAH-*`, `INC-*`, `IMP-*`, RTW3-manual citations, drawing conventions.
- Determinism rationale: RNG stream identity, draw-layout/save-continuity
  freezes, integer/fixed-point rounding, canonical ordering, hash re-pins.
  Example: `combat/src/torpedoes/detonation.ts:729-736` ("MUST preserve the
  reliability draw as the SOLE/stable draw; do NOT insert a second draw").
- Ticket traceability: `TODO #N`, `ticket N`, wayfinder ids, `P-1 ticket 07`.
- Units/scales on numeric model fields, negative-space notes ("intentionally not
  carried"), generated-file guards (`// GENERATED ... do not edit`).
- Boundary and safety constraints: runtime-free/IPC, strict excess-key decode,
  content-compiler stage ordering, CSP and crash-bundle redaction, platform
  portability (Windows paths, `pnpm` invocation), licence/provenance headers.
- Suppressions that state an unchangeable external reason, e.g.
  `phase-engine/test/errors.test.ts:52` ("deliberately pass null to prove the
  runtime non-null guard") and the `12-F2` runtime-guard expectations.

## Sequencing (each unit ends in a check)

1. **Sweep A - noise codemod.** Bucket 1 items 1, 2, 3, 4. Build the lever: a
   script that strips banners, JSX narration, self-path headers, and name-only
   JSDoc; do not hand-edit. Verify with `pnpm check`.
2. **Sweep B - stale, duplicated, scratchpad.** Bucket 1 items 5, 6, 7, 8. Small
   and file-targeted.
3. **Refactor R1 - `localeCompare` audit.** Classify each of the 46 sites as
   authoritative or display; fix the authoritative ones with `compareCodePoints`.
   Own ticket; treat a moved golden hash as a stop condition.
4. **Refactor R2 - React dependency stabilization.** Own ticket; needs
   `pnpm test:e2e` and `pnpm snap`.
5. **Refactor R3 - `as unknown as` boundary casts.** By package, smallest first:
   `ai`, then `persistence`, then `ship-design`, then `phase-engine`, then
   `desktop/main`.
6. **Refactor R4 - placeholders and `snapshotClone` typing.**
7. **Refactor R5 - `ship-design` stage registry.** Its own sprint.

## Corrections from verification

- A worker claimed `campaign-engine/src/priorities.ts` still regex-parses
  `p.reason`. It does not. Lines 62-63 record that the comparator captures
  fields at construction and "never re-parses `reason`". That pre-prune REFACTOR
  is already done. Dropped.
- The other headline claims were re-read and hold: the 8 `exhaustive-deps`
  sites, the 8 self-path headers, the 21 suppressions, and the missing
  `world-map/README.md` are all confirmed on this tree.

## Open questions and uncertainty

- **`localeCompare` scope.** 46 source files use it; the determinism rule governs
  canonical ordering only. Which sites are authoritative needs a per-site read.
  Several are benign display sorts. Any authoritative fix risks a golden-hash
  change, which is a documented stop condition.
- **`as unknown as` count.** 31 source files is measured; how many are genuine
  boundary violations versus test scaffolding needs the packet-level decode
  seam story from each owner.
- Workers sampled the densest files, so a few DELETE candidates likely hide in
  unread test files. A follow-up full pass would firm up test-narration counts.
- `KEEP` calls trusted cited `DESIGN-*`/`ADR-*`/ticket ids without resolving each
  doc; a small number may be stale.
