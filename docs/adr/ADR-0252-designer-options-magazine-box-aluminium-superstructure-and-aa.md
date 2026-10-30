# ADR-0252: Magazine box, aluminium superstructure and AA fit are additive designer options with provisional values

Applies to: content, desktop, ship-design

## Status

Superseded by: ADR-0345

Accepted (2026-10-20). Follows the owner's walkthrough of the RTW3 ship-design screen
against ours. Extends ADR-0233 (designer draft-schema v2) and follows the optional-field
precedent of ADR-0242 (colonial service) and the tertiary battery (ADR-0233 §1).

## Context

Three RTW3 design options had no counterpart in the designer: the magazine box, the
aluminium superstructure, and light/medium AA guns with AA directors. The manual grounds
only part of each (RTW3 manual pp.42-43, 45):

- Magazine box: already modelled as the `MAGAZINE_BOX` armour region; only the one-click
  choice was missing.
- Aluminium superstructure: usable "once you have developed the technology"; it "saves 10%
  of the hull weight" but makes the ship "more susceptible to fire damage" (p.45). The 10%
  is the manual's; the fire susceptibility has no figure.
- Light and medium AA guns: "limited not only by weight, but also by topside space"; more
  fit once double and quadruple mounts are developed (p.43). AA directors: "up to a
  maximum of 4" (p.43). No weight, space or date is given.

## Decision

1. **Magazine box** adds no field. It is the presence of the `MAGAZINE_BOX` armour region.
   The Protection section offers a checkbox that adds the region with its existing starting
   convention (`newArmourRegion`) or removes it; thickness, length and material stay editable.
2. **Aluminium superstructure** is `DesignDraft.aluminiumSuperstructure?: boolean`. Absent or
   `false` is steel, and the key is never written for an unset design.
3. **AA fit** is `DesignDraft.antiAircraft?: { lightGuns, mediumGuns, directors }`, three
   non-negative integers, `directors` at most 4 (the manual's maximum). Absent means none.
4. **Values** live in two optional sections of the ship balance (`balance.yaml`):
   `aluminiumSuperstructure` and `antiAircraft`. Every number is a PROVISIONAL gameplay
   parameter (ADR-0213 balance target), tunable in that one place, and none is presented as
   historical. The single exception is the 10% hull-weight saving, which is the manual's.
   An absent section means the option has no effect and is not offered, as for the tertiary
   battery. Availability dates are a provisional `fromMonth` per section, not a researched
   technology, because the pack has no aluminium or AA technology yet.
5. **Compile effects** use integer arithmetic. Aluminium lowers the hull ledger line by the
   configured basis points. The AA fit adds weight (guns and directors) to the armament line,
   and a deck footprint to the topside, like the tertiary battery. The fire susceptibility
   and the AA's effect in battle are not modelled; the designer says so rather than implying
   it.

## Compatibility

All additions are optional and additive, so **`DESIGN_SCHEMA_VERSION` stays 2**. A design
that sets none of them serialises byte-identically to one that predates them, an older file
loads unchanged, and no forward migration exists. The content-schema draft mirror, the
design header and `validateDraftShape` carry the fields; the content lock is refreshed for
the balance sections. Existing designs and golden hashes do not move
(`pnpm check:golden`, `pnpm check:determinism`). Choosing schema v3 was rejected: absence
already means legacy behaviour, and a bump would force a migration and a re-pin for nothing.

## Consequences

- Provisional numbers can be retuned by editing `balance.yaml` only; nothing else encodes them.
- Neither option affects battle yet: fire damage and the air-defence model do not read them.
- Turning the sections on for production, or attaching a real technology gate, is a later,
  deliberate change and may then move reference hashes.
