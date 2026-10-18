# ADR-0232: Armour region model and manual parity

## Status

Accepted (2026-10-18). Records the armour decisions of the wayfinder map
[#152](https://github.com/joaooliveira92/iron-tide/issues/152) (tickets
[#154](https://github.com/joaooliveira92/iron-tide/issues/154) and
[#159](https://github.com/joaooliveira92/iron-tide/issues/159)), grounded in the
RTW3 manual (pp.37–39, 135) via the audit
[#153](https://github.com/joaooliveira92/iron-tide/issues/153)
(`docs/research/rtw-designer-audit.md`). Implementation is tracked by the
ship-designer spec (see map #152, terminus ticket
[#163](https://github.com/joaooliveira92/iron-tide/issues/163)).

## Context

The manual's construction choices name one universal armour-field set
(pp.37, 135): **B, BU, BE, D, DE, T, TT, SEC, CT**, where **T is "main gun turret
and barbette armour"** (no separate turret-side/barbette value) and **TT is the
turret roof**. The repository's canonical list is a different twelve-region set
(`packages/ship-design/src/armour.ts:8-21`): it lacks DE, TT and SEC, keeps
`BARBETTE` separate from `TURRET_FACE`, and carries extra regions
(`DECK_SLOPE`, `MAGAZINE_BOX`, `SPLINTER_PLATING`, `TORPEDO_BULKHEAD`,
`TORPEDO_BELT`) that the manual does not name as universal fields. The list is
mirrored at the content boundary
(`packages/content-schema/src/reference-design.ts:16-29`) and pinned by a parity
test (`packages/ship-design/test/schemaCompat.test.ts:29-36`); 1880 reference
designs consume it, and an independent battle vocabulary
(`packages/combat/src/damage/armorModel.ts:20-52`) names `TURRET_FACE`/`BARBETTE`.

## Decision

### 1. The universal field set is the manual's nine fields

The designer presents exactly **B, BU, BE, D, DE, T, TT, SEC, CT**, labels and
abbreviations verbatim. Canonical-region mapping:

| Manual field | Canonical region | Action |
| --- | --- | --- |
| B Belt | `BELT_MAIN` | keep |
| BU Upper belt | `BELT_UPPER` | keep |
| BE Belt extended | `BELT_ENDS` | keep; display "Belt extended (BE)" |
| D Deck | `DECK_MAIN` | keep |
| DE Deck extended | `DECK_EXTENDED` | new |
| T Turret + barbette | `TURRET_FACE` → `TURRET` | rename; `BARBETTE` folds in |
| TT Turret top | `TURRET_TOP` | new |
| SEC Secondary gun armour | `SECONDARY_GUN` | new |
| CT Conning tower | `CONNING_TOWER` | keep |

`DECK_SLOPE` and the underwater/magazine regions (`MAGAZINE_BOX`,
`SPLINTER_PLATING`, `TORPEDO_BULKHEAD`, `TORPEDO_BELT`) remain canonical but are
**not** part of the universal field list; they are driven from the schemes of §3
and the underwater/magazine surfaces respectively.

### 2. Region semantics

- `DECK_EXTENDED` is a **deck** (add it to the deck set at `armour.ts:167`): it
  mirrors BE over the ends, with `lengthMm` = coverage beyond the citadel and
  `heightMm` = athwartship deck width.
- `TURRET_TOP` and `SECONDARY_GUN` are near-normal plates (no deck reduction),
  fixed-block sized.
- `TURRET` keeps the present `TURRET_FACE` handling and now carries turret and
  barbette.
- The `ARMOUR_INEFFECTIVE_VS_ADVERSARY` critical-surface set becomes belts +
  `DECK_MAIN` + `DECK_EXTENDED` + `TURRET`. `CITADEL_INCOMPLETE` and magazine
  protection are unchanged (`BELT_MAIN` stays the belt).
- Starting sizes (`newArmourRegion`, `START_THICKNESS_UM`) and all magnitudes are
  **BALANCE TARGET** conventions (ADR-0213), not sourced: the manual names the
  fields, never a number.

### 3. Named schemes over the region list

A scheme is named data (id, display name, citation, availability gate) plus a
deterministic transformation over the region list. Applying a scheme is one
undoable edit; the per-region editor is the "Custom" view. Catalogue, grounded at
pp.38–39: **`FLAT_DECK_ON_BELT`** ("flat deck on top of belt", in-era, default),
**`PROTECTED_CRUISER`** (in-era, cruiser types), **`BELT_AND_SLOPING_DECK`**
(gated, WW1) and **`ALL_OR_NOTHING`** (gated; `allOrNothingRegions`,
`armour.ts:535-546`). Gated schemes unlock by the global designer unlock year
(ADR-0229). Scheme thickness patterns are balance targets.

## Invariants

- The nine universal fields map one-to-one onto canonical regions; `BARBETTE` is
  not a canonical region and not a field.
- Weight (F-A1) and penetration margin (F-A2) remain the per-region functions;
  the new regions enter them unchanged.
- No scheme is a parallel armour model: it is a transformation plus a label.
- All arithmetic stays integer/fixed-point; the region set is order-stable.

## Consequences

- **Persistence:** the canonical list changes; draft-schema v1 → v2 migration is
  defined in ADR-0233. Migration merges any `BARBETTE` into `TURRET`
  (`thicknessUm`/`lengthMm`/`heightMm` = per-field maximum; material and incline
  from the thicker source, ties broken by lexicographic material id; a lone
  barbette becomes the turret). New regions absent ⇒ not fitted.
- **Content:** the `ARMOUR_REGION_IDS` mirror and the schema-parity test re-pin;
  every 1880 reference design carrying `BARBETTE` is re-authored by the same rule.
- **Combat:** the independent battle zone vocabulary
  (`packages/combat/src/damage/armorModel.ts`) must align — the design's `TURRET`
  maps to combat's `TURRET_FACE`; combat's `BARBETTE` zone maps to `TURRET_FACE`
  or is retired for the 1880 ruleset, with hit-location weighting folded. Owned by
  the spec.
- **Determinism:** the region set and weights change authoritative hashes; goldens
  are re-pinned deliberately per `docs/agents/golden-repinning.md`.

## Alternatives rejected

Keeping `BARBETTE` as a separate field (diverges from the manual's single T and
the map's parity bar); folding DE into `DECK_MAIN`'s length (the manual gives DE
its own value); modelling schemes as a parallel armour model rather than a
transformation; a numeric freeboard input (that is ADR-0233).
