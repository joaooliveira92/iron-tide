# D2: Canonical unit table

**Type:** grilling · **Status:** resolved

## Question

Where do the canonical internal units live, and what is the table? Which units
are canonical and which are authoring/display only?

## Answer

One **dependency-free canonical units module** (owned by `packages/contracts`,
the lowest dependency-free layer that already holds `SafeInt`/`RoundingMode`)
declares:

- the canonical unit per quantity,
- the branded safe-integer type per unit,
- the one sanctioned conversion to/from *authoring* units, used only at the
  content-compile boundary.

Canonical units are the de-facto ones already in the code, now declared once
(`packages/ship-design/src/units.ts`, `packages/campaign/src/designUnits.ts`):

| Quantity | Canonical unit | Notes |
| --- | --- | --- |
| Mass | kilogram (kg) | `Mm`-style brand; `kgPerHitPoint`, displacement |
| Length / calibre / armour / diameter | micrometre (µm) | `UM_PER_INCH = 25_400`, `MM_TO_UM = 1000` |
| Speed | micrometres per second (µm/s) | `KNOTS_TO_UMS = 514_444` |
| Volume | litre (L) | |
| Power | kilowatt (kW) | |
| Ratio | basis point (bp, 1/10000) | `mulBp`, `scaleByBp` |
| Time | integer month / year | no wall-clock |
| Money | integer treasury unit | see D3 |

The existing per-package brands and constants are **consolidated** here by an
expand→migrate→contract sequence so no call site breaks:

1. **expand** — add the canonical table/brands beside the existing ones;
2. **migrate** — repoint importers package by package;
3. **contract** — delete the duplicate definitions.

Authoring units (mm, knots, inches) and display units remain **non-canonical**:
authoring conversion happens once at the content-compile boundary; display
conversion happens only at the presentation boundary (D6).

## Why

The recon shows the canonical units are already real but scattered across
`ship-design`, `campaign` and per-package constants, with no single table
(ADR-0202 defers exactly this). Declaring them once removes the drift risk, and
putting them in `packages/contracts` preserves the directed package graph and
avoids a speculative new package (ENGINEERING-CONTRACT "no speculative
packages").

## Gating

Introducing the table and re-branding **value-preservingly** (same integer
stored) does not move the reference run. Any ticket that changes a stored scale
or value is gated by 0005 (D7).
