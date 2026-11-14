# Decision Request: display names for design threats (issue #582)

## Status

Blocked pending owner decision. Overview (and RequirementChip) keep showing the raw threat id for the expected enemy gun until this is decided.

## Trigger

Issue #582 (Plain-language Overview terms) requires the Overview "expected enemy gun" value to resolve the threat id (for example `qf_6in`) to a display name through content, and to fail a test rather than print the id when no name exists. No such name exists in content, and no owner-approved wording exists for it. Writing names would mean inventing canonical wording.

## Evidence

- `content/production/1880/ship-building/balance.ts` (around lines 1014-1057) defines `threats` as `{ id, penetrationUm }` only. The `ThreatProfile` type (`packages/ship-design/src/armour.ts:42`) has no name field.
- `packages/content-schema/src/reference-design.ts:48` stores `designThreatId` as a plain non-empty string.
- `apps/desktop/src/renderer/lib/en-us-messages.ts` has no threat strings. No `*.yaml` under `content/` contains `qf_6in`.
- `apps/desktop/src/renderer/components/design-workspace/RequirementChip.tsx:27` shows the same id as "Designed against" via `words(id)`, so the raw id also appears outside Overview.
- The ids are grounded in the penetration table comment in `balance.ts`, which cites Brassey's Naval Annual 1886 and `Research index #456 [ship-building-1880-pre-era-armament, not migrated]`. That is the source a name would need to match.

## Why agent judgment is insufficient

The threat id maps to a real 1880s adversary gun. Any display name (for example "6-inch quick-firer") is a canonical historical label. Choosing it is a content decision, and an incorrect label would reach the player. Deriving a name from the gun family `gun_qf_6in_40` by prefix would invent a link between a threat profile and a gun part, which the content does not state.

## Options

### Option A: add an owner-approved `displayName` to each threat profile

- Behavior: each entry in `balance.threats` gets a `displayName`. Overview and RequirementChip resolve the id through content. A missing name fails the test, as issue #582 specifies.
- Advantages: matches the acceptance criterion exactly. Names are reviewable as content.
- Risks: needs approved wording for the ten threat ids in `balance.ts`. The new field changes compiled content, so canonical hashes and goldens may change and need an understood cause.
- Compatibility impact: `ThreatProfile` gains a field. Content schema and any fixtures that build threats need updating.
- Migration impact: none for saves if the field is display-only, but the golden check must be run.
- Scope and effort: small in code, larger in content review.

### Option B: keep the raw id and drop the threat row from Overview

- Behavior: Overview stops showing the threat. RequirementChip is unchanged.
- Advantages: no content change, no new canonical wording.
- Risks: removes player-visible information. Does not satisfy the issue's "resolves to a display name" criterion.
- Scope and effort: smallest.

### Option C: derive a name from the penetration value

- Behavior: show "about 150 mm penetration" in place of a gun name.
- Advantages: uses existing canonical data, no invented label.
- Risks: a new player-facing concept that the issue did not ask for. Changes what the threat row means.
- Scope and effort: small, but it is a design change.

## Recommendation

Option A. The owner supplies the wording for the ten ids in `balance.ts`, or approves the names drafted from the pre-era armament research. Then the golden check is run, and the issue's threat criterion is met. Until then, leave the Overview threat fragment unchanged and labelled "expected threat" with the raw id.

## Work safely completed while blocked

- Overview labels, the qualification row, the accommodation names, upgrade names, and the severity glosses for Blocking, Critical and Advisory are implemented on branch `feat/issue-582-plain-overview-terms`.
- `overview.test.ts` and the workspace test assert the new terms.
- `CONTEXT.md` (which `GLOSSARY.md` links to) gains entries for ship type, qualifies as, and planned upgrades.
- No content, compiled data, or golden files were changed.
