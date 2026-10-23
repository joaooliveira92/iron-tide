# Decision Request: E-1 1940-1949 hull forms and part values

## Status

Blocked pending owner decision.

## Trigger

Ticket #254 (E-1 05, spec #249) asks for hulls, parts, armament, ship types and reference designs for 1940-1949, each traced to the
dossier. The dossier ([`docs/research/e-1-1940-1970-timeline.md`](../../docs/research/e-1-1940-1970-timeline.md)) and ADR-0283 decide
technology names, fields, years, ship-class entry and technology costs. They give no hull dimensions, form coefficients, gun, mount,
torpedo or plant data, masses, ratings or prices. Authoring those would fabricate simulation values (AGENTS.md stop condition).

## Evidence

- `content/production/1880/ship-building/hull-forms.yaml` has five forms, the newest `pre_dreadnought_form`. There is no form for a
  1940s destroyer, cruiser, fleet carrier or battleship.
- The newest part in `parts/*.yaml` is `availableFrom: 1936-01`. No plant, gun, mount, torpedo or fitting exists for 1940-1949.
- Each existing form and part carries sourced or labelled values (hull weight law fitted to White 1894, Admiralty coefficients fitted to
  trial power, gun data from navweaps.com and Brassey; see the ship-building `README.md`). The tests in `packages/ship-design/test`
  check them against historical ships.
- Audit #259 (`.ai/reports/e-1-era-mechanics-audit.md`, issue #283): the part schema has no radar, sonar, AA, missile-launcher or
  hangar family, so those parts and the carrier, missile-armed and ASW ship types cannot be authored whatever the values.
- The owner approved narrowing #254 to what the schema can express: hulls, guns, mounts, torpedoes, propulsion plants and fittings.

## Why agent judgment is insufficient

A form coefficient, a gun mass or a plant rating decides what a 1945 design weighs, costs and shoots. Deriving them from the nearest
1936 item (the ADR-0283 D5 route for technology costs) is not sound here: they are physical quantities, and a 1945 destroyer is not
a scaled 1900 one. Wrong values pass the existing validators and move every later golden.

## Options

### Option A: research pass, then author

- A new dossier ticket sources each 1940-1949 value to named works (Conway's 1922-1946 and 1947-1995, Friedman's destroyer and
  cruiser volumes, navweaps.com gun and torpedo tables) with per-value provenance. Values without a source come back here individually.
  #254 then authors only sourced or labelled values.
- Advantages: matches the method used for 1880-1939 and the dossier; values stay defensible.
- Risks: slower; some values may stay unsourced and need owner decisions.
- Compatibility impact: none until content lands, then one golden re-pin as #254 states.
- Migration impact: none.
- Scope and effort: one research ticket, then #254.

### Option B: owner supplies the values

- Advantages: fastest. Risks: the owner carries the sourcing. Same impact as A.

### Option C: author labelled `BALANCE_TARGET` values without a source

- Advantages: the 1940s become playable at once. Risks: ships and guns of the decade drift from history with no way to check; contradicts
  the spec rule that no value is invented. Not recommended.

## Recommendation

Option A, limited to the schema-expressible set: destroyer, light and heavy cruiser and battleship hulls; 5-inch DP, 6-inch and 8-inch
automatic-loading guns and mounts; 21-inch acoustic torpedo; high-pressure steam plant; all-welded hull. Fleet and escort carrier,
missile, ASW and sonar items wait for #283.

## Work safely completed while blocked

- #259 audit merged to `dev`; follow-ups #278-#283 filed.
- No content was authored for #254.
