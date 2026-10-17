# D3: Measurement presets and canonical→display conversion

**Type:** grilling · **Status:** resolved

## Question

How are measurement presets and per-category selections defined, and what
canonical→display conversions does the formatter own?

## Answer

Display measurement is a presentation concern over the canonical table
(ADR-0202/0215). The formatter owns the canonical→display conversions and the
display-unit taxonomy:

- **Speed:** canonical `UmPerSec` → knots (`KNOTS_TO_UMS`) as the default in both
  presets (naval speed is knots historically).
- **Length/calibre/armour/range:** canonical `Um` → imperial inches
  (`UM_PER_INCH`) / yards, or metric mm/m, per preset and per-category selection.
- **Mass:** canonical `Kg` → tonnes (and pounds only where the manual's bomb-weight
  sense applies, p.18), or metric tonnes.
- **Volume / power:** canonical `Litre` / `Kw` → the preset's display unit.
- **Ratio:** canonical `Bp` → a percentage (`bp / BP_ONE`).

The `measurementPreset` (`imperial` default per manual p.18, `metric`) and the
per-category `measurementSelections` come from U-2's effect-free contract; U-3
**validates selections against the canonical unit table** (an unknown category or
an incompatible display unit is rejected) and implements the conversions. Authoring
units (mm, knots, inches) and display units are non-canonical; the only other
sanctioned conversion is the compiler's authoring→canonical pass (ADR-0218). The
imperial default's rationale is the manual's measurements passage (p.18) — a
display default, never a storage spec (ADR-0215).

## Why

The manual fixes only the imperial display default (inches/yards/pounds, p.18) and
describes no metric option or conversion table (`docs/research/u-1-canonical-values.md`
§3/§5); the canonical table and the conversion factors are ADR/engine facts
(ADR-0215). Owning the conversions once in the formatter closes the scattered,
ad-hoc `/1000`, `/1_000_000`, `/UM_PER_INCH` call sites and guarantees switching
preset changes no canonical value.
