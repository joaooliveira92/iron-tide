# Decision Request: Promote the USA to a playable nation (ten-nation roster)

## Status

Resolved (2026-10-16) by the owner as Option A; recorded as ADR-0214, which
supersedes ADR-0205. The USA is promoted to the ten-playable 1880 roster.

## Trigger

`ADR-0205` ("Nine playable nations; the rest AI-only behind a readiness gate",
Accepted 2026-10-15 / DR-005) demoted the United States to AI-only so the
playable roster matches the manual's nine. The USA is, however, already
authored as a complete playable nation, and the repository's own release gate
for 1880 requires **at least ten playable nations**. Two authoritative sources
now disagree about the same roster, and the disagreement changes the compiled
opening state and its authoritative hashes:

- `packages/ship-design/test/productionNationCoverage.test.ts:40` asserts
  `playable.length >= 10` (comment: "1880 first release commits 14 nations
  (10 playable)") — **red at `dev`/HEAD with the USA at nine**.
- `content/production/1880/countries.yaml:251` marks the USA `isPlayable: false`
  — nine playable.

An agent must not reverse an Accepted ADR or fabricate gameplay on its own, so
this is a decision request, not a fix.

## Evidence

- **The USA is content-complete for every readiness-gate dimension**
  (ADR-0205: start, queues, economy, design identity, research, diplomacy,
  geography-aware AI, presentation content, viability tests, plausibility
  review):
  - start / identity / regime / economy / doctrine / AI archetype:
    `content/production/1880/countries.yaml:249-360`
  - construction queue: `content/production/1880/constructions.yaml:71`
    (`con_usa_amphitrite`); fleet: `content/production/1880/fleets.yaml:265`
    (`fleet_usa_atlantic`)
  - design identity: `content/production/1880/designs.yaml:267`
    (`des_usa_amphitrite`), `ship-building/reference-designs/usa/`,
    `ship-building/naval-profiles/usa.yaml`
  - research: `content/production/1880/research.yaml:67`
  - diplomacy: `content/production/1880/diplomacy.yaml:62,286,299`
  - presentation: `content/production/1880/presentation.yaml:57`
  - renderer art: `us.flag.1880` + `us.ship.1880` retained in
    `apps/desktop/src/renderer/content/nationAssetManifest.ts:83-86`
- **The demotion was a lone flag flip.** `git show c86b1df` ("feat(scope): 1880
  sole start and nine playable nations") changed exactly one USA content line
  (`isPlayable: true -> false`), dropped `"us"` from `PLAYABLE_SLOT_COUNTRY_IDS`,
  and re-pinned the campaign-snapshot hash. No USA content was removed.
- **The release gate expects ten.** `productionNationCoverage.test.ts:36-40`
  (`>= 10`) and its comment "10 playable". The in-progress, uncommitted working
  tree is the change that lowers this floor to 9 — i.e. the nine-roster is the
  newer, contested state, not the authored baseline.
- **Manual baseline says nine.** `docs/research/rtw3-manual-baseline.md:45-47`
  and `ADR-0205` cite manual p.18 as nine playable
  (Great Britain, Germany, France, Austria-Hungary, Russia, Italy, Japan,
  China, Spain). This is the direct contradiction to resolve.
- **Tests that lock the nine** (all flip with the promotion):
  `apps/compiler-cli/test/content-surface.test.ts:160`,
  `apps/desktop/src/main/commands/listNewGameOptions.test.ts:51`,
  `apps/desktop/src/renderer/content/playable-slot-roster.test.ts`.
- **Hash/compatibility surface** that a promotion moves (verified by drafting
  the change): `content/production/1880/content-lock.json` bodyHash; the
  production campaign-snapshot pins in
  `apps/desktop/src/main/commands/commitMonth.test.ts:238-249`. The
  cross-process `golden/hashes.json` is **unaffected** (its child compiles a
  fixture with a GBR-only slot, not the production pack).

## Why agent judgment is insufficient

The choice flips an Accepted ADR and changes which nation a player may pick in
the sole playable scenario, the compiled nation slots, and their authoritative
snapshot hashes (a compatibility-relevant change). It also decides whether
`docs/research/rtw3-manual-baseline.md` (nine) or the release gate (ten) is
authoritative. These are product/design calls; the agent cannot resolve them
from the code without guessing, and the repo forbids implementing disputed
behaviour before approval.

## Options

### Option A: Promote the USA — ten playable nations

- Behavior: `countries.yaml` USA `isPlayable: true`; add `"us"` to
  `PLAYABLE_SLOT_COUNTRY_IDS`; update the roster tests to ten; re-pin
  `content-lock.json` and the campaign-snapshot hashes.
- Advantages: matches the repo's own release gate (`>= 10`) and the
  already-complete USA content; makes the whole `productionNationCoverage` gate
  green; the USA was authored as a first-class nation, so the work is a flag
  flip plus re-pins.
- Risks: contradicts manual p.18 as recorded in
  `rtw3-manual-baseline.md` / ADR-0205; if the manual truly lists nine, this is
  a deliberate Bluewave divergence and must be documented as such.
- Compatibility impact: production campaign-snapshot bodyHash/rawHash move
  (understood cause: USA slot `ai -> playable`); a compatibility note/ADR is
  required.
- Migration impact: content only; no save-schema change.
- Scope and effort: S (one content flag, one renderer list, three test files,
  two hash re-pins).

### Option B: Keep nine — the USA stays AI-only

- Behavior: no change; ADR-0205 stands.
- Advantages: matches manual p.18; no hash/compatibility churn.
- Risks: `productionNationCoverage.test.ts:40` (`>= 10`) stays red until its
  floor is lowered to 9 — a gate weakening that AGENTS.md says must be fixed at
  the cause, not by lowering the floor; leaves the fully authored USA content
  unused as a playable path.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: S (lower the gate floor and record why the authored USA is
  AI-only).

## Recommendation

**Option A (promote the USA to ten playable nations)**, recorded as a new ADR
(next free id: ADR-0214) that supersedes ADR-0205 for the USA, because the
repository's own release gate already requires ten playable and the USA is
content-complete — the nine-roster appears to be a G-3 clean-up regression
rather than authored intent. This recommendation is only valid if the owner
confirms that diverging from manual p.18 (nine) is acceptable; if the manual's
nine is binding, choose Option B and lower the gate floor with a documented
reason instead. Do not implement the promotion before this decision is accepted.

## Work safely completed while blocked

- A ready-to-review draft of the Option A change was produced on an isolated
  branch/worktree (`.worktrees/usa-playable`, branch
  `feat/usa-playable-promotion`) and captured as a unified diff at
  `.scratch/usa-playable.patch`.
- Draft verification with the promotion applied: `content-compiler` 151/151,
  `ship-design` `productionNationCoverage` 4/4, `compiler-cli`
  `content-surface` 9/9, and the desktop `playable-slot-roster`, `slotBridge`,
  `borders-1880-data`, `DossierSlidePanel`, and
  `new-game-commissioning-review` tests all green; `commitMonth` and
  `listNewGameOptions` re-pinned to the new authoritative content.
- Pre-existing, unrelated red noted on `dev`/HEAD (not caused by this draft):
  `apps/desktop/src/main/commands/listNewGameOptions.test.ts:84` expects Spain
  excluded from `playerSlotId`, but `des_esp_numancia`
  (`designs.yaml:795`, added in `f966c06`) makes `hasOwnContent(spain)` true.
  This draft deliberately does not touch that assertion.

## Resolution

Accepted as Option A. The implementation is the focused promotion described
above and records the release contract as fourteen committed and ten playable
nations in ADR-0214; ADR-0205 is superseded. The `>= 10` production coverage
assertion is retained unchanged as the intentional release invariant. The
unrelated Spain `playerSlotId` failure is tracked separately and left untouched.
