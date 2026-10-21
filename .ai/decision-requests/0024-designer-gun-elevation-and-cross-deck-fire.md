# Decision Request: Designer gun elevation and cross-deck fire

## Status

Resolved (2026-10-21) by owner delegation: **Option A**, recorded as
[ADR-0266](../../docs/adr/ADR-0266-s5-presence-values-and-open-requests-resolved-by-delegation.md).

## Trigger

Parity ticket [#190](https://github.com/joaooliveira92/iron-tide/issues/190) asks for the RTW3 designer's
"increased elevation", "cross-deck fire" and "gun shields". Gun shields, casemates and open mounts already exist as
mount types (`ARMAMENT_MOUNT_TYPES`: `CASEMATE`, `DECK_SHIELDED`, `DECK_OPEN`) and are chosen through "Replace with" in the
Armament editor; nothing is missing there. Two items are not modelled: **increased elevation** and **cross-deck fire**.
Modelling them needs authoritative numbers and a combat effect that no source supplies.

## Evidence

- `packages/armament/src/model.ts:130-133`: `elevationMinDeg` / `elevationMaxDeg` are documented "Not authored today".
- The manual names both options (pp.41-42, 135) but states no figure for either
  (`docs/research/rtw-designer-audit.md` section 4: every magnitude stays a BALANCE TARGET).
- Combat has no range-from-elevation mechanic to attach an elevation option to; arcs are per mount position
  (Firing arcs view), so a wing turret's cross-deck arc is already expressible by placing it.
- Roadmap DR-004 puts post-1880s designer content out of scope; elevation was a dreadnought-era gun refinement and
  the manual does not date it for the 1880-99 window (audit section 3.4 has no entry for it).

## Why agent judgment is insufficient

Adding either option changes authoritative combat outcomes (range, hit rate, arc coverage), needs a draft-schema bump
and migration (ADR-0233), a golden re-pin, and invented magnitudes. Which era the options belong to is a gameplay
decision the manual does not settle.

## Options

### Option A: Out of scope for the 1880 start (recommended)

- Behavior: no new fields. Record in the parity spec that shields, casemates and open mounts are covered by mount
  type, cross-deck fire is covered by arc placement, and elevation is a later-era option.
- Advantages: no invented numbers, no schema change, no golden movement.
- Risks: the designer still lacks an explicit "increased elevation" toggle that RTW3 players expect.
- Compatibility impact: none. Migration impact: none. Scope and effort: documentation only.

### Option B: Model elevation as a per-mount option with a range effect

- Behavior: an optional boolean per gun mount; adds weight and cost and a range bonus in combat.
- Advantages: closer RTW3 parity.
- Risks: a combat balance change with unsourced constants; needs the elevation fields authored for every gun part.
- Compatibility impact: draft-schema v3, combat range change. Migration impact: forward migration, golden re-pin.
- Scope and effort: schema, content, compile, combat and UI; several tickets.

## Recommendation

Option A. Revisit with Option B when the ruleset horizon moves past the 1880s start or a sourced elevation table exists.
Do not implement either before approval.

## Work safely completed while blocked

- Confirmed gun shields, casemates and open mounts are reachable today via mount type.
- Closed belt coverage / torpedo defence ticket [#189](https://github.com/joaooliveira92/iron-tide/issues/189) as covered
  by the editable armour regions.
