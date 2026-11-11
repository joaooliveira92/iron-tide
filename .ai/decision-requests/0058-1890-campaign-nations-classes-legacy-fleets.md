# Decision Request: 1890 campaign foundation (milestone prompt vs the 1880-only baseline)

## Status

Blocked pending owner decision.

## Trigger

The supplied milestone asks for a deterministic **1890** campaign with ten named nations, five classes available at start (`B`, `CA`, `CL`, `KE`, `AMC`), `DD`/`BB`/`BC`/`SS`/`CV` locked behind research, dockyard caps, per-caliber gun quality and a seeded legacy-fleet generator. The repository's design baseline says 1880 is the only start year and already ships much of the requested machinery. Building the milestone as written would contradict the baseline and change authoritative outcomes.

## Evidence

- `RULES.md` "Scope and values": the sole start year is 1880; a scenario with no content pack is not selectable; fourteen committed nations, ten playable.
- `.ai/REQUIREMENTS.md` BW-SCP-001 (1880 sole start, production content) and BW-SCP-003 (ten playable nations: the manual's nine plus the USA, four AI-only behind a readiness gate).
- `content/production/1880/` is the only content pack. 14 nations in `countries.ts`, 10 with `isPlayable: true`. Nation set differs from the prompt (the prompt omits e.g. Netherlands, Ottoman Empire, Brazil, Portugal; China = `qing`).
- `DD` is an ordinary class at the 1880 start: `buildOrder` in every `ship-building/naval-profiles/*.ts` lists `DD`; `balance.ts` has `ddMaxDisplacementKg`. The prompt requires `DD` locked at start.
- Existing equivalents of prompt scopes: `packages/content-schema/src/naval-profile-vocab.ts` (ship type ids, postures, component access), `balance.ts` (yard `maxDisplacementKg`, yard expansion `maxDisplacementIncreaseBp`), `packages/campaign/src/fleetSize.ts` and `scenario.ts` and the New Game fleet-method screens (starting fleets), `content/production/1880/technologies.ts` (115 tech entries, per-nation research).
- Golden replays (`golden/replays/production-1880-*`) and `content-lock.json` pin the 1880 pack; a second pack or reclassified `DD` changes them.

## Why agent judgment is insufficient

Plausible readings produce different authoritative outcomes:

1. A second, parallel 1890 pack changes BW-SCP-001/002 and `RULES.md` (design layer).
2. Re-dating the existing pack to 1890 invalidates all goldens, the content lock and ADR-0201.
3. Gating `DD` behind research in 1880 changes gameplay and replay hashes for all 14 nations.
4. Treating the prompt as a gap audit of the 1880 pack (class-unlock gating, yard caps, gun quality, legacy-fleet generator) needs no new year but gives a different deliverable.

Higher authority (design) outranks the prompt, so I cannot apply the prompt silently.

## Options

### Option A: Add 1890 as a second scenario/pack

- Behavior: new `content/production/1890` pack, scenario selectable beside 1880; `DD` and later classes locked via tech prerequisites in the 1890 pack only.
- Advantages: 1880 goldens untouched; matches the prompt literally.
- Risks: amends BW-SCP-001/002 and `RULES.md`; doubles content (nations, designs, techs, research, goldens); large.
- Compatibility impact: save/pack versioning must carry start year; 1880 saves unaffected.
- Migration impact: none for 1880; new pack lock.
- Scope and effort: multi-sprint (T2), roughly 8 to 12 tickets.

### Option B: Keep 1880 sole start; port the mechanics only

- Behavior: add class-unlock gating through technology, a canonical legality service with structured diagnostics, dockyard cap diagnostics, per-caliber gun quality and a seeded legacy-fleet generator with report, all against the 1880 pack. Verify what already exists first and only fill gaps. `DD` stays available unless explicitly approved to gate.
- Advantages: no design change; smaller; reuses existing abstractions.
- Risks: does not deliver an 1890 campaign or the five-class start; some prompt acceptance criteria cannot be met.
- Compatibility impact: goldens change only where gating or fleets change; each repin needs an understood cause.
- Migration impact: save version bump if new state is persisted.
- Scope and effort: 4 to 6 tickets.

### Option C: Re-date the single pack to 1890

- Behavior: replace 1880 with 1890.
- Advantages: one pack.
- Risks: rewrites the product baseline, ADR-0201, all goldens and content-lock; discards N-1/N-2 work.
- Compatibility impact: breaking.
- Migration impact: full repin.
- Scope and effort: largest; not recommended.

## Recommendation

Option B first, as a gap audit (`search` agent over the existing legality, yard, gun and fleet code, mapped to the prompt's scopes A to H), then slice only the gaps into tickets. Revisit Option A once the shared mechanics exist, because the 1890 pack would then be content work on a proven framework. Do not implement either before approval.

## Work safely completed while blocked

- Read-only orientation of repo authority docs, content layout and existing vocabulary (this document's evidence section). No code, branch, worker or PR created.
- Open questions for the owner: which option; if A, which ten nations (prompt list vs current playable set); whether `DD` may be research-gated in the existing pack; whether Haiku workers should be dispatched per ticket after slicing (they would use `delegate_task` with `dispatch:check`).
