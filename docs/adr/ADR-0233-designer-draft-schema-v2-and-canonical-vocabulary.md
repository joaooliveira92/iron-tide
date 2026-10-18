# ADR-0233: Designer draft-schema v2 and canonical vocabulary

## Status

Accepted (2026-10-18). Records the model fields and vocabulary added by the
wayfinder map [#152](https://github.com/joaooliveira92/iron-tide/issues/152)
(tickets [#155](https://github.com/joaooliveira92/iron-tide/issues/155),
[#156](https://github.com/joaooliveira92/iron-tide/issues/156),
[#157](https://github.com/joaooliveira92/iron-tide/issues/157),
[#159](https://github.com/joaooliveira92/iron-tide/issues/159)), grounded in the
RTW3 manual (pp.28, 39, 41, 135) via the audit
[#153](https://github.com/joaooliveira92/iron-tide/issues/153). Supersedes nothing.
Implementation is tracked by the ship-designer spec (map #152, terminus
[#163](https://github.com/joaooliveira92/iron-tide/issues/163)).

## Context

The ship-design draft (`packages/ship-design/src/compileShared.ts:19-81`) is
mirrored structurally at the content boundary
(`packages/content-schema/src/reference-design.ts:121-128`) and serialized by the
design file (`packages/ship-design/src/persistence.ts:8-9`,
`DESIGN_FILE_FORMAT = "bwdesign"`, `DESIGN_SCHEMA_VERSION = 1`), which migrates
forward only and rejects unknown future versions
(`persistence.ts:148-159`). The map's parity bar adds four model surfaces the
draft cannot express today: an engine-priority axis, fire-control positions, a
freeboard preset, a tertiary battery, and an armour-scheme reference. Each is
either additive or a vocabulary change, so they are versioned together.

## Decision

### 1. Draft-schema v2

Raise `DESIGN_SCHEMA_VERSION` to **2** and add these **optional** fields to the
draft (and its content-schema mirror):

| Field | Home | Type / default | Decision |
| --- | --- | --- | --- |
| `enginePriorityBp` | `machinery` | int in `[-10_000, 10_000]`, default 0 (balanced) | #155 — negative reliability-optimised, positive speed-optimised (manual p.41); **not** Normal/Economy/Speed |
| `positions` | new `fireControl` group | non-negative int, default 0 | #156 — fire-control positions count (manual p.135) |
| `freeboardProfile` | `hull` | `"NORMAL" \| "LOW"`, default `"NORMAL"` | #157 — low/normal preset (manual p.39); not a numeric input |
| `tertiary` | new battery group | `{ caliberUm, count }`, absent = none | #157 — tertiary guns as a count (manual p.28); no role |
| `schemeId` | `armour` | optional string | #159 — named armour scheme (ADR-0232 §3) |

Per-calibre **gun quality** is a read-only projection of research data
(`packages/combat/src/gunnery/constants.ts`), so it adds no draft field.

### 2. Canonical vocabulary

Add a `TERTIARY` battery role and a `TERTIARY_GUN` weapon category alongside the
existing `MAIN`/`SECONDARY`/`TORPEDO` roles and gun categories
(`packages/ship-design/src/batteries.ts:4-11`), mirrored in content-schema and
kept identical by the existing vocabulary parity test. No tertiary "role"
concept.

### 3. Migration v1 → v2

Forward-only, deterministic, in `persistence.ts`:

- `BARBETTE → TURRET`: the merge rule fixed by ADR-0232.
- New optional fields absent ⇒ defaults (`enginePriorityBp = 0`,
  `positions = 0`, `freeboardProfile = "NORMAL"`, no tertiary battery, no scheme
  ⇒ "Custom").

### 4. Authority and arithmetic

The new fields are authored inputs or balance targets; their magnitudes are
`BALANCE_TARGET` values (ADR-0213) grounded only as *fields* by the manual,
provenanced in `docs/research/rtw-designer-parity-values.md` (#162). All enter
integer/fixed-point arithmetic; non-integers are rejected at construction. The
gun-quality readout is presentation of research state, not stored.

## Invariants

- A v1 design file decodes and migrates to v2 without loss (except the ADR-0232
  barbette merge).
- Every new field is optional, so a v2 draft authored without them is legal.
- The content-schema mirror and the ship-design runtime types stay structurally
  identical (the existing parity test).
- Identical inputs produce identical hashes; non-default values change
  authoritative outcomes and require a deliberate golden re-pin.

## Consequences

- Design files and content reference-designs gain the fields; the
  schema-parity and persistence fixture tests are extended, and the
  design-file round-trip and migration tests cover v1 → v2.
- Golden hashes move where the new fields are non-default; the re-pin reports
  old/new value and cause (ADR-0230 precedent).
- A future schema change continues the same forward-only migration chain.

## Alternatives rejected

A new file format for the extra fields; a required (non-optional) shape that
would invalidate every existing draft; a discrete Normal/Economy/Speed engine
triad (no manual grounding); per-mount gun quality (diverges from the manual);
unit machinery (manual-silent).
