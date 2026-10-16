# Decision Request: Prestige row 0 cannot land — a required prestige field and untouched production content are mutually exclusive

## Status

Blocked pending owner decision. Blocks S-2 ticket 01 and, transitively, tickets
02–09 (the whole S-2 sprint). Does not affect the mine-warfare campaign or N-1.

## Trigger

S-2 ticket 01 (`.scratch/s-2-prestige-and-career/issues/01-prestige-state-and-seeding.md`)
must add a **required** prestige field to every compiled nation and prove it against
a fixture, while its own acceptance checklist requires **"Production 1880 content
is untouched (values arrive in ticket 08)"**. The two cannot both hold:

1. Map decision D2 (`.scratch/s-2-prestige-and-career/decisions/D2-representation-and-seeding.md`)
   fixes the field as **required with no engine default** — "not worked around with an
   absent-until-set optional field".
2. D6 / the spec / decision request 0003 forbid authoring any production prestige
   value before the scale is resolved: "production content and ruleset values are
   authored only after it resolves".
3. But the gate compiles the production pack through the campaign compiler. A
   required `NationState.prestige` with no authored production value makes that
   compilation fail, turning the standing gate red.

So ticket 01 as written is unsatisfiable: satisfying (1)+(3) requires authoring
production values, which (2) forbids; satisfying (2) requires the field to be
optional/defaulted, which (1) forbids; satisfying (1)+(2) breaks (3).

## Evidence

- `.scratch/s-2-prestige-and-career/issues/01-prestige-state-and-seeding.md:13-21`
  — acceptance: "bounded integer prestige for every nation", "Missing … fails
  compilation", "Production 1880 content is untouched (values arrive in ticket 08)".
- `.scratch/s-2-prestige-and-career/decisions/D2-representation-and-seeding.md:13-18`
  — required field, authored per nation, no default, compatibility-version bump.
- `.scratch/s-2-prestige-and-career/spec.md:99,104` — "required … prestige on every
  nation; authored per nation in 1880 content"; production values after 0003 (D6).
- `.ai/decision-requests/0003-prestige-scale-and-values.md` — the scale, per-nation
  starts, loss/gain magnitudes and score rule are unknown; inventing them is a stop
  condition.
- `packages/cross-process-test/test/production-pack-loop.test.ts:76-108` — compiles
  `content/production/1880` through `buildContentBundleArtifact` →
  `CampaignCompiler.compile` (which calls `buildNationStates`,
  `packages/campaign/src/nationCompilation.ts:168`) and throws on any error. This is a
  normal `pnpm test:run` gate, so a required unauthored field fails the gate.
- `content/production/1880/countries.yaml`, `economies.yaml`, `research.yaml` —
  production nations carry no prestige anywhere (no field, no collection).
- `docs/adr/ADR-0213-opening-posture-balance-choices.md` — precedent exists for
  authoring _balance-choice magnitudes_ in production (tension, squadrons, divisions)
  with `provenance.kind: balance_adjustment` — but prestige was deliberately NOT
  treated that way; it was escalated to 0003 instead.

## Why agent judgment is insufficient

Every available resolution changes a governed outcome or breaks a gate:

- Authoring production prestige now decides the prestige scale (gameplay) that the
  project's own rule says must be researched or escalated, never invented — a stop
  condition (AGENTS.md; ADR-0210 "values the manual lacks are researched or
  escalated"; 0003 Option C requires explicit owner acceptance).
- Making the field optional/defaulted contradicts accepted decision D2 and would let
  the reference snapshot drift without a deliberate re-pin.
- Leaving production unauthored breaks the production-pack loop gate.

This is a conflict between an accepted decision (D2), a second accepted decision
(D6), and a ticket's own checklist; it is not a routine local choice.

## Options

### Option A: Author production prestige now as admitted balance placeholders (ADR-0213 pattern)

- Behavior: ticket 01 authors a uniform, clearly-labelled placeholder prestige in
  `content/production/1880/countries.yaml` (or a new `prestige.yaml`) recorded with
  `provenance.kind: balance_adjustment` / `sourceStatus: BALANCE_TARGET`; ticket 08
  replaces it with sourced values when 0003 resolves.
- Advantages: unblocks S-2 tickets 01–07 immediately; keeps the gate green; follows
  the ADR-0213 precedent for the 1880 opening posture.
- Risks: a placeholder start affects sacking timing until 08; must not be mistaken
  for a sourced calibration.
- Compatibility/migration: same as ticket 01 (compatibility-version bump; goldens
  re-pinned with cause).
- Scope/effort: ticket 01 only, plus a short ADR extending ADR-0213 to prestige
  placeholders.

### Option B: Gate S-2 ticket 01 on 0003 (author real production values in ticket 01)

- Behavior: resolve 0003 first (owner supplies values or `research` returns sourced
  values); ticket 01 then authors the sourced per-nation values in the same change.
- Advantages: no placeholder; one authoring pass; values are sourced on first land.
- Risks: waits on an external decision/research; delays all of S-2 structurally.
- Compatibility/migration: same as Option A.
- Scope/effort: blocks ticket 01 until 0003 closes.

### Option C: Invert D2 — optional field, compiled default

- Behavior: `NationState.prestige` becomes optional, defaulted at the lower bound
  until authored.
- Advantages: production compiles untouched with almost no work.
- Risks: directly contradicts D2 ("not … an optional field"); hides the gap the
  ticket is meant to close; the default is itself an engine-invented value.
- Scope/effort: smallest; highest policy cost.

## Recommendation

**Option A** if the owner accepts a clearly-labelled placeholder start (the
ADR-0213 precedent), because it unblocks the sprint without pretending the value is
sourced; otherwise **Option B**. Do not implement the disputed authoring before
approval, and do not make the field optional/defaulted.

## Work safely completed while blocked

- State verification (`git status` clean; branch `refactor/comment-prune-sweep-a`,
  the plan's documented baseline; no remote; `pnpm preflight` exit 0).
- Operating-context load and identification that `.ai/SPRINT-PLAN.md`'s "Frontier"
  section is stale (see `## Work safely completed` note in the SPRINT-PLAN update).
- No code, content, tests, or authoritative artifacts changed.
