# ADR-0284: E-1 1940-1949 ship and part values

## Status

Accepted (2026-10-23). The owner delegated the open decisions of decision request
[0041](../../.ai/decision-requests/0041-e-1-1940s-hull-and-part-values.md) to the implementing agent ("you decide"). Builds on
[ADR-0283](ADR-0283-e1-1940-1970-content-decisions.md) and [ADR-0213](ADR-0213-opening-posture-balance-choices.md) for balance targets. Evidence:
`docs/research/e-1-1940s-hull-and-part-values.md`, audit `.ai/reports/e-1-era-mechanics-audit.md`.

## Decision

1. **Torpedo.** The 21-inch acoustic homer is the US Mark 35 (1949), the only one for surface tubes. It requires `torp_acoustic_homing`;
   the part is dated 1949 while the technology stays 1943. Fleet torpedoes before 1949 use the existing 21-inch parts.
2. **Missing 1930s guns.** The 5-inch/38 (1934) and 6-inch/47 DP (1948) enter with the 1940s set. The 5-inch gun is not gated on the 1945
   technology, because the gun predates it; the twin mount is.
3. **Loading label.** `gun_auto_loading_turret` keeps its name. The 8-inch/55 mount requires it; the 6-inch/47 DP mount requires
   `gun_dp_rapid_5in`. The provenance note of each says the 6-inch projectiles are hand-loaded (navweaps.com).
4. **Unsourced values.** Each value the research note lists as unsourced is a `BALANCE_TARGET` (provenance kind `balance_adjustment`),
   copied or scaled by mass or calibre from the nearest existing part of the same family, with the derivation in its note. Hull
   coefficients reuse the nearest existing form, and every such value is replaced when a weight fraction is sourced.
5. **Welded hull.** No schema key is added. `hc_all_welded_hull` stays a gate with no weight effect.
6. **Plant pressure.** The steam plant records 650 psi (Naval Historical Review) and notes the 600 psi disagreement.

7. **Classification by era.** The class rules were one set for all years and capped a destroyer at 2,000 t, so Fletcher and Gearing classed as
   light cruisers. `balance.yaml` gains an optional `classificationFromMonth` list; the rules in force for a month are the last entry not after
   it, else the base rules. The 1940 entry raises only the destroyer and light-cruiser boundary to 4,000 t (the model counts the full fuel load
   and Gearing is 3,460 t at full load); every other threshold repeats the base until the cruiser and battleship slices source theirs.
8. **Fitted values.** The destroyer form's `formBp`, its Admiralty coefficient, and the steam plant's mass, volume and fuel curve are
   `BALANCE_TARGET` values fitted so the Gearing reference closes on its sourced 3,460 t full load, 36.8 kn and zones. Copying the nearest
   plant (114 kg/kW) would outweigh the ship. The plant and the 21-inch tube carry no structured provenance, so they join the placeholder
   allowlist with the same justification as the other inherited legacy records.

## Consequences

- No value is unlabelled; none claims a source it does not have.
- The base is thinner than ticket #254 assumed. The ship-building pack authors 1880-1899 only: the newest gun is 1900, there are four
  plants, five hull forms and gun models for three nations, and every national profile caps hull forms, plants, gun calibre and
  displacement at 1890s limits. The 1940s set therefore needs the national profiles opened for the nations that get the content,
  and the migration pins (315 parts, 92 designs, 825 placements) move with it. Ticket #254 is re-sliced accordingly.
