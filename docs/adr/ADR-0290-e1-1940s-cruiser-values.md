# ADR-0290: E-1 1940-1949 cruiser values

## Status

Accepted (2026-10-25). Slice 2 of ticket #254, under the owner's standing delegation of unsourced values to the implementing agent
([ADR-0284](ADR-0284-e1-1940s-ship-and-part-values.md)). Evidence: `docs/research/e-1-1940s-hull-and-part-values.md` sections 3-6, 10 and 12.

## Decision

1. **Reference ships.** The Worcester (light cruiser, six 6-inch/47 twin turrets) and the Des Moines (heavy cruiser, three 8-inch/55 triple turrets and six
   5-inch/38 twin mounts) are the 1948 United States starters. Hull dimensions, standard and full-load displacement, 120,000 shp, 33 kn, fuel and the
   belt, deck, turret and magazine thicknesses are Navypedia figures, confirmed against the section 10 table. Both starters close on their sourced
   full-load displacement and on 33 kn.
2. **Two hull forms.** `light_cruiser_form` and `heavy_cruiser_form`, as ADR-0284 listed. Length and L/B bands are anchored on the reference ships; `formBp` and
   the Admiralty coefficient are fitted per form so each reference closes on its sourced displacement and speed; the five coefficient fields are copied
   from `destroyer_form`. Every one of these is a `BALANCE_TARGET` that a sourced hull-weight fraction replaces.
3. **Guns.** `gun_dp_6in_47_twin` (requires `gun_dp_rapid_5in`, hand-loaded projectiles) and `gun_ap_8in_55_triple` (requires `gun_auto_loading_turret`), both dated
   1948, both `MAIN_GUN`. Mount masses are the sourced totals split evenly per barrel after the gun mass, as for the 5-inch twin. Crew is modelled as 11 and 15 per
   barrel (22 and 45 against the sourced 21 and about 44) because the part model reads crew as a whole number per barrel. Mount cost scales the nearest family by
   mount mass. Rounds per gun (300 and 150) are estimates.
4. **Classification.** The 1940 rules entry now admits light cruisers up to 19,000 t (Worcester is 17,997 t at full load) with a belt up to 6 inches (Worcester is
   127 mm). A light cruiser stays defined by guns of 6 inches or less. Both limits are `BALANCE TARGET`.
5. **Yard.** `yard_large` admits 230 m and a 500 t crane lift (Des Moines is 218.4 m overall; its triple turret is 458 t). Both are `BALANCE TARGET`. United
   States practical displacement reaches 25,000 t from 1940.
6. **Triple turrets.** The part-model migration reclassifies every mount of three or more barrels as a broadside central battery (D17). The 8-inch triple turret
   therefore translates to a `BROADSIDE_BATTERY` part with three guns, and the pinned D17 rows grow from nine to twelve. This is a known mismodelling of the mount
   type, not a decision that triple turrets are batteries; a native multi-gun turret path in the part model is follow-up work, and it should drop the three rows.
7. **Not authored.** Light cruiser anti-aircraft guns, radar and fire-control directors wait for the engine support audited in #283; the starters carry the optical
   rangefinder only and compile with fire-control warnings.

## Consequences

- No value is unlabelled; none claims a source it does not have.
- Part, design and placement pins move (323 parts, 95 designs, 871 placements); replays differ only in the recorded content hash.
- The battleship slice still owns the battleship thresholds, form and armament.
