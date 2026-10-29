# ADR-0345: Ship Design Model and Draft Schema

Consolidates: ADR-0232, ADR-0233, ADR-0243, ADR-0252

Applies to: combat, content, content-schema, desktop, ship-design

Rule: The ship design data model defines a versioned draft with optional fields, a canonical armour-region set mapped to the manual's nine universal fields, named armour schemes as deterministic transformations, and additive options from balance targets, all guarded by a session that explains new blocking or critical findings at once.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0232
Supersedes: ADR-0233
Supersedes: ADR-0243
Supersedes: ADR-0252

## Context

The ship-design data model was shaped by four interconnected decisions from the wayfinder map [#152](https://github.com/joaooliveira92/iron-tide/issues/152) and its follow-on tickets, grounded in the RTW3 manual via the audit `docs/research/rtw-designer-audit.md`.

**Armour.** The manual names nine universal armour fields (B, BU, BE, D, DE, T, TT, SEC, CT) but the code carried twelve canonical regions with `BARBETTE` separate from `TURRET_FACE` and extra regions (`DECK_SLOPE`, `MAGAZINE_BOX`, `SPLINTER_PLATING`, `TORPEDO_BULKHEAD`, `TORPEDO_BELT`) that the manual does not name as universal fields. Parity was required.

**Draft schema v1** could not express five model surfaces that the manual names: an engine-priority axis (p.41), fire-control positions (p.135), a freeboard preset (p.39), a tertiary battery (p.28), and an armour-scheme reference (ADR-0232 §3).

**Design edits** were unguarded: a player could pick an option that made the design unbuildable and learn about it only from the Review accordion, which did not tie the finding to the choice that caused it or offer an undo.

**Additive options** lacked counterparts for three RTW3 features: the magazine box (already modelled as an armour region but missing a one-click choice), aluminium superstructure (manual p.45: "saves 10% of the hull weight"), and light/medium AA guns with directors (manual p.43). The manual grounds only part of each; weights, costs and availabilities are provisional balance targets.

## Rules

### 1. Armour region set

The universal field set is the manual's nine fields, mapped one-to-one onto canonical regions:

| Manual field | Canonical region | Notes |
|---|---|---|
| B Belt | `BELT_MAIN` | keep |
| BU Upper belt | `BELT_UPPER` | keep |
| BE Belt extended | `BELT_ENDS` | keep |
| D Deck | `DECK_MAIN` | keep |
| DE Deck extended | `DECK_EXTENDED` | new; a deck, mirrors BE over the ends |
| T Turret + barbette | `TURRET` | rename from `TURRET_FACE`; `BARBETTE` folds in |
| TT Turret top | `TURRET_TOP` | new; near-normal fixed-block plate |
| SEC Secondary gun armour | `SECONDARY_GUN` | new; near-normal fixed-block plate |
| CT Conning tower | `CONNING_TOWER` | keep |

`DECK_SLOPE`, `MAGAZINE_BOX`, `SPLINTER_PLATING`, `TORPEDO_BULKHEAD` and `TORPEDO_BELT` remain canonical regions but are **not** universal fields; they are driven from named armour schemes or underwater/magazine surfaces.

### 2. Armour invariants

- `ARMOUR_INEFFECTIVE_VS_ADVERSARY` critical-surface set: belts + `DECK_MAIN` + `DECK_EXTENDED` + `TURRET`.
- `CITADEL_INCOMPLETE` and magazine protection are unchanged (`BELT_MAIN` stays the belt).
- Starting sizes (`newArmourRegion`, `START_THICKNESS_UM`) and all magnitudes are BALANCE_TARGET conventions (ADR-0213).
- Weight (F-A1) and penetration margin (F-A2) remain per-region functions.
- All arithmetic stays integer/fixed-point; the region set is order-stable.

### 3. Named armour schemes

A scheme is named data (id, display name, citation, availability gate) plus a deterministic transformation over the region list. Applying a scheme is one undoable edit; the per-region editor is "Custom". Catalogue, grounded at manual pp.38–39:

| Scheme | Availability |
|---|---|
| `FLAT_DECK_ON_BELT` | in-era, default |
| `PROTECTED_CRUISER` | in-era, cruiser types |
| `BELT_AND_SLOPING_DECK` | gated, WW1 |
| `ALL_OR_NOTHING` | gated |

Gated schemes unlock by the global designer unlock year (ADR-0229). No scheme is a parallel armour model: it is a transformation plus a label.

### 4. Draft-schema v2

`DESIGN_SCHEMA_VERSION` is **2**. These optional fields are added to the draft:

| Field | Group | Type / default |
|---|---|---|
| `enginePriorityBp` | machinery | int in `[-10_000, 10_000]`, default 0 (balanced) |
| `positions` | new `fireControl` group | non-negative int, default 0 |
| `freeboardProfile` | hull | `"NORMAL" \| "LOW"`, default `"NORMAL"` |
| `tertiary` | new battery group | `{ caliberUm, count }`, absent = none |
| `schemeId` | armour | optional string, absent ⇒ "Custom" |

A `TERTIARY` battery role and `TERTIARY_GUN` weapon category are added alongside the existing `MAIN`/`SECONDARY`/`TORPEDO` roles and gun categories.

### 5. Migration v1 → v2

Forward-only, deterministic, in `persistence.ts`:
- `BARBETTE → TURRET`: merge rule — `thicknessUm`/`lengthMm`/`heightMm` = per-field maximum; material and incline from the thicker source, ties broken by lexicographic material id; a lone barbette becomes the turret.
- New optional fields absent ⇒ defaults (`enginePriorityBp = 0`, `positions = 0`, `freeboardProfile = "NORMAL"`, no tertiary battery, no scheme ⇒ "Custom").
- A v1 design file decodes and migrates to v2 without loss (except the barbette merge).
- Every new field is optional, so a v2 draft authored without them is legal.

### 6. Additive designer options

**Magazine box.** No new field. A Protection checkbox adds or removes the `MAGAZINE_BOX` armour region with its starting convention; thickness, length and material stay editable.

**Aluminium superstructure.** `DesignDraft.aluminiumSuperstructure?: boolean`. Absent or `false` is steel; the key is never written for an unset design. Lowers the hull ledger line by configured basis points in `balance.yaml`.

**AA fit.** `DesignDraft.antiAircraft?: { lightGuns, mediumGuns, directors }`, three non-negative integers, directors ≤ 4. Adds weight to the armament line and deck footprint to topside. Absent means none.

**Values in balance.yaml.** Two optional sections: `aluminiumSuperstructure` and `antiAircraft`. Every number is PROVISIONAL (ADR-0213 balance target) except the manual's 10% hull-weight saving. Availability dates are provisional `fromMonth` values. An absent section means the option has no effect and is not offered. `DESIGN_SCHEMA_VERSION` stays 2 — all additions are optional and additive, so no forward migration exists.

### 7. Design edit guard

Every draft edit passes through `useDesignSession` which wraps `useChoiceCheck`. After an edit, the guard compares findings before and after by `BoardFinding.key`. Only a **BLOCKING** or **CRITICAL** finding that was not present before opens `ChoiceProblemDialog`: what failed, why, the in-play consequence, the remedies, with "Undo this choice" and "Keep it and fix it myself". A design still broken by a finding already shown does not reopen it.

The field that introduced a finding stays marked (`aria-invalid` plus `FieldError`, the ReUI `c-input-5` pattern) while that finding remains. Errors are filed by `editField(e)`: `<kind>:<setting>` (e.g. `set_hull:materialId`), or `set_armour_region:<region>` because an armour edit carries a whole region. Panels receive `errorFor(field)` and pass `error` to `SelectField` / `NumberField`. Finding text is reused from the compiled finding, never rewritten for the UI.

## Consequences

- A v1 design file migrates to v2 without loss; golden hashes move where new fields or regions are non-default and are re-pinned deliberately per `docs/agents/golden-repinning.md`.
- The content-schema mirror and ship-design runtime types stay structurally identical, enforced by the existing parity test.
- Combat's independent battle zone vocabulary must align: the design's `TURRET` maps to combat's `TURRET_FACE`; combat's `BARBETTE` zone maps to `TURRET_FACE` or is retired for the 1880 ruleset with hit-location weighting folded.
- A new panel gets the free dialog guard; it needs only `errorFor` for the inline mark.
- Edits from the plan (placements, moves) also open the dialog when they break the design.
- Provisional numbers can be retuned by editing `balance.yaml` only.
- Neither aluminium nor AA affect battle yet (fire damage and air-defence model do not read them).

## Alternatives rejected

Keeping `BARBETTE` as a separate field (diverges from manual parity); folding DE into `DECK_MAIN`'s length (the manual gives DE its own value); modelling schemes as a parallel armour model; a numeric freeboard input; a new file format for the extra schema fields; a required (non-optional) shape that would invalidate every existing draft; a discrete Normal/Economy/Speed engine triad (no manual grounding); a schema v3 bump for the additive options (absence already means legacy behaviour).