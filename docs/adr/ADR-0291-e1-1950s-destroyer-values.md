# ADR-0291: E-1 1950-1959 destroyer values and the limit of 1950-1970 ship content

Applies to: content, ship-design

## Status

Superseded by: ADR-0350

Accepted (2026-10-25). Ticket #256 under the owner's standing delegation of unsourced values to the implementing agent
([ADR-0284](ADR-0284-e1-1940s-ship-and-part-values.md)). Evidence: `docs/research/e-1-1940s-hull-and-part-values.md` section 13 and the audit
`.ai/reports/e-1-era-mechanics-audit.md`.

## Decision

1. **Reference ship.** The Forrest Sherman (DD931) is the 1955 United States starter: 124.1 m, 13.7 m, 2,800 t standard and 4,916 t full load, 70,000 hp, 33 kn,
   500 t of oil, three 5-inch/54 Mark 42 single mounts, and the four 533 mm tubes carried by DD931 and DD932 only. It closes on its full-load displacement
   and on 33 kn.
2. **Gun.** `gun_dp_5in_54_single` (1954, requires `gun_dp_rapid_5in`): the sourced gun, projectile, mount mass, rate and train; the mount split, costs, round
   volume, volume and footprint follow the conventions of ADR-0284 and are `BALANCE_TARGET`.
3. **Hull form.** `postwar_destroyer_form`, anchored on the Forrest Sherman; `formBp` and the Admiralty coefficient are fitted and the other coefficients copied from
   `destroyer_form`, all `BALANCE_TARGET`.
4. **Classification.** From 1950 a destroyer may displace up to 6,000 t and a light cruiser starts at 6,000 t; both `BALANCE_TARGET`, since 4,916 t at full load
   would otherwise class as a light cruiser.
5. **Range.** The model returns 1,725 nm at 20 kn on 500 t, against the sourced 4,500 nm, because the fuel-rate curve is the 1945 destroyer's balance target
   (ADR-0284 decision 8). The starter asks for 1,500 nm instead of claiming the sourced figure.
6. **What is not authored, and why.** The 76 mm twin AA mounts, the 324 mm ASW tubes and the Hedgehogs, and every carrier, missile, ASW and radar ship of 1950-1970,
   need part families the part model lacks (#283) and combat models the campaign battle path does not reach (#280, #281, #282). Content must not promise behaviour
   the engine lacks (ADR-0283), so ticket #258 (1960-1970 ships) and the rest of #256 wait on those follow-ups; decision request 0044 returns the choice to the owner.

## Consequences

- No value is unlabelled; none claims a source it does not have.
- Part, design and placement pins move (325 parts, 96 designs, 883 placements); replays differ only in the recorded content hash.
