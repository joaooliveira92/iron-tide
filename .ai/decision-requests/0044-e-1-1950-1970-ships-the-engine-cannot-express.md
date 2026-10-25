# Decision Request: E-1 1950-1970 ship content the engine cannot express

## Status

Blocked pending owner decision.

## Trigger

Tickets #256 (1950-1959 ships and parts) and #258 (1960-1970) ask for hulls, parts, armament, ship types and reference designs. Beyond the gun-and-torpedo destroyer authored in
ADR-0291, the ships of those decades are carriers, missile ships, ASW frigates and helicopter ships. ADR-0283 forbids content that promises behaviour the engine lacks.

## Evidence

- `.ai/reports/e-1-era-mechanics-audit.md` finding 4: `PART_FAMILIES` has no radar, sonar, AA, missile or hangar family and `CAPABILITY_KINDS` no matching kind (#283).
- Findings 2 and 3: air groups, air defence, carrier operations and ASW are unreached from a campaign battle (#280, #282) and no missile model exists (#281).
- Classification: the destroyer rule requires a torpedo tube and the frigate-escort rule forbids one, so a 1960s missile or ASW frigate with only 324 mm ASW tubes fits no class.
- Technologies for these capabilities are authored (1950-1970) and labelled inert in their notes.

## Why agent judgment is insufficient

Authoring the ships either fabricates behaviour (a missile ship with no missiles) or means engine work that expands scope into the deferred subsystems of #280 to #283.

## Options

### Option A: Wait for the engine follow-ups

- Behavior: #256 and #258 stay at the ADR-0291 destroyer; #260 runs 1880-1970 on the content that exists.
- Advantages: no content promises what the engine lacks.
- Risks: 1960-1970 has technologies but no new ships.
- Compatibility impact: none. Migration impact: none. Scope and effort: none now.

### Option B: Author gun-armed ships of other nations only

- Behavior: add UK, Soviet and other 1950s gun cruisers and destroyers (for example Tiger 6-inch twin, Sverdlov 152 mm triple) from sourced pages, same method as ADR-0290.
- Advantages: more player choice in 1950-1959 without new engine work.
- Risks: each nation needs profile caps and form fits; triple turrets add to the D17 central-battery rows.
- Compatibility impact: pins and replay hashes move per slice. Migration impact: none. Scope and effort: about one slice per ship.

### Option C: Author the missile and ASW ships as hulls with their guns and tubes only

- Behavior: ships exist, without missile launchers, sonar or hangars.
- Advantages: the 1960s fleet is visible.
- Risks: breaks ADR-0283; the ships would be weaker than their names say and the classification rules need new torpedo-free destroyer rules.
- Compatibility impact: classification rule change. Migration impact: none. Scope and effort: medium.

## Recommendation

Option A for #258 and the remainder of #256, with Option B as the next content slices if more 1950s choice is wanted before #283 lands.
