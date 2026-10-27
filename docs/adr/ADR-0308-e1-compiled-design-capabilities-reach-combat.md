# ADR-0308: Compiled design capabilities reach combat and are decoded strictly

Applies to: armament, combat, content-schema, ship-design

## Status

Accepted (2026-10-26) for [#288](https://github.com/joaooliveira92/iron-tide/issues/288), part of
[#283](https://github.com/joaooliveira92/iron-tide/issues/283) under
[#249](https://github.com/joaooliveira92/iron-tide/issues/249). Applies the additive-optional policy of
[ADR-0264](ADR-0264-t1-battle-offer-state-keeps-compatibility-version-4-0-0.md).

## Context

A part capability travelled from `content-schema` through the `ship-design` part catalogue and
loadout resolution, and stopped at the compile stage. `CompiledDesignVersion` — the only design
record combat reads — carried no capability data, so a `damage_control` part could not affect a
battle and a later radar part would have no reachable consumer either. The first consumer is
damage control: the existing training bonus already scales pumping and firefighting, but a design's
own gear did not.

## Decision

1. **One optional, canonically ordered list.** `CompiledDesignVersion.capabilities` is an optional
   `readonly DesignCapability[]`. The ship-design compile stage collects every resolved part's
   capabilities and sorts them by `kind`, then by canonical serialization so equal-kind entries have
   a stable order. Duplicates are retained: a design may carry two pumps, and a consumer decides
   whether to sum (damage control) or take the best (a later radar level).
2. **The design hash covers the list.** `CompiledDesign` includes the list before its hash is
   computed, and `toEngineDesign` copies it into the engine design fields. A design that gains a
   capability therefore moves its own hash; a design without one is byte-identical.
3. **Combat projection carries the list to the tactical unit.** `TacticalShipUnit.capabilities` is
   optional and copied by `promoteTacticalUnit`. `buildDamageControlContexts` sums the
   `damage_control` effects (capped at 10,000 bp) and adds that bonus to the per-side training
   bonus before scaling pumping and firefighting. No capability means the previous resource values
   exactly.
4. **Persistence decodes designs strictly.** The save snapshot's `designs` record is now decoded by
   a `StorableCompiledDesignVersionSchema` rather than `Unknown`. The capabilities list is a closed
   discriminated union checked for a non-decreasing `kind` order and strict excess-key rejection.
   Other nested design records (`armament`, `torpedoArmament`, `sourceDraft`) stay `Unknown` because
   they already have their own compiled contracts; no field is defaulted or migrated.
5. **No compatibility bump.** The field is optional and absent from every stored campaign design, so
   earlier 4.0.0 saves decode unchanged and re-encode with no such key (the ADR-0264 test). The
   campaign `designs.yaml` records are compiled by the legacy path and carry no capability.
6. **One understood production pin moves.** Reference designs are production content too, and
   `majestic_like` carries `pumps_damage_control`; its `CompiledDesign.hash` now covers the
   capability, so the first-month AI design study embeds a changed design. The desktop `commitMonth`
   production snapshot pin moves from `ad549b07…`/209361 to `a02b4659…`/210074 (rawHash
   `4d78a6e9…` to `3128b392…`). All 11 golden hashes and all 13 replays stay byte-identical because
   no replay reaches a capability-bearing design.

## Consequences

- `pumps_damage_control` now acts in a battle for a submitted design that carries it; the reference
  loadout `majestic_like` proves the compile copy.
- Later capability consumers (#289-#295) inherit one seam instead of adding a second design record.
- A save containing a capability list written by a reader without this field is refused by the
  strict design decode or the snapshot hash gate, never silently loaded.

## Alternatives rejected

- **Carry capabilities in `sourceDraft`.** It is arbitrary authored data, not a compiled contract,
  and combat would have to re-resolve parts.
- **Add a second combat-only design record.** It would duplicate the authoritative design and drift.
- **Keep `designs` as `Unknown` and validate only in combat.** The save boundary is the trust
  boundary; a malformed capability must fail on load.
