# ADR-0332: E-1 1940-1949 battleship and 16-inch gun values

Applies to: content, ship-design

## Status

Accepted (2026-10-29) for [#254](https://github.com/joaooliveira92/iron-tide/issues/254) under
[#249](https://github.com/joaooliveira92/iron-tide/issues/249). Applies the unsourced-value delegation of
[ADR-0284](ADR-0284-e1-1940s-ship-and-part-values.md) and the balance-target policy of
[ADR-0283](ADR-0283-e1-1940-1970-content-decisions.md). Evidence:
`docs/research/e-1-1940s-hull-and-part-values.md` section 14.

## Context

#254 delivered the 1945 destroyer and the 1948 light and heavy cruisers. Its remaining documented
slice was the 1940s battleship: a 16-inch/50 gun, its triple turret, a fast-battleship hull form and a
reference design. The pack had no gun above 8 inches with a modern mount, no fast-battleship form,
and the United States profile capped gun calibre at 15 inches, armour at 11 inches and the dock at
5,000 t.

## Decision

1. **Reference ship.** The Iowa class is the 1945 United States battleship starter: 262.1 m wl,
   33.0 m beam, 48,110 t standard and 57,540 t full load, 212,000 shp (158,084 kW), 32.5 kn, 7,621 t
   of oil, three 16-inch triple turrets and ten 5-inch/38 twin mounts. It closes on its sourced
   full-load displacement within 50,000 kg and returns 32.5 kn.
2. **Gun and mount.** `gun_ap_16in_50_triple` (1943, requires `gun_16in_heavy_guns`): the sourced
   406 mm bore, 50 calibres, 121,519 kg gun with breech, 1,225 kg AP Mark 8 shell, 299.4 kg charge
   (2,444 bp, DERIVED), 2 rounds per minute and 1,735 t triple turret. The turret splits as 578,467 kg
   per barrel with no fixed mass. Cost, round volume, crew, volume and footprint scale the 8-inch
   triple by mass and follow the ADR-0284 conventions; every unsourced value is `BALANCE_TARGET`.
3. **Triple-turret translation.** The legacy gun read path reclassifies a three-barrel mount as a
   central battery. The 16-inch triple therefore uses the same D18 identity path as the 8-inch triple;
   `equivalenceReport` enumerates the three new placements, and the D17/D18 pin moves from 12 to 15
   placements.
4. **Hull form.** `fast_battleship_form` is anchored on Iowa's length and 7.94 L/B. `formBp` 8530 and
   `cFormX100` 24200 are fitted `BALANCE_TARGET` values; waterplane, sheer, fullness and LCB are
   copied from `heavy_cruiser_form`. Cost complexity is copied from `pre_dreadnought_form`.
5. **Profile and dock.** The United States profile raises its gun calibre ceiling to 406 mm, its
   armour ceiling to 432 mm, its 1940 practical-displacement band to 60,000 t and its shared dock
   limits to 60,000 t. The profile has no per-era dock field, so the 1880 dock record notes the
   later raise. A single `yard_super` (280 m, 60,000 t, 2,500 t crane) admits the hull; it is a
   `BALANCE_TARGET` because no 1940s yard survey is cited.
6. **No golden repin.** The new content changes the content hash and therefore every replay's
   recorded content field; no checkpoint moves because no replay reaches a 1943-1945 design. The
   11 golden hashes are unchanged.

## Consequences

- A player can design and build a 1940s battleship with a sourced 16-inch gun, and the reference
  starter validates and builds.
- Part, design and placement pins move (333 parts, 97 designs, 909 placements, 264 gun placements).
- The 1940 classification rules admit the ship as a battleship without a new era entry.
- The other-nation 1940s ships remain open on #254; this ADR records only the documented US slice.
