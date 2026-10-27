# Decision Request: Campaign source for air groups and air-defence values

## Status

Blocked pending owner decision.

## Trigger

[#295](https://github.com/joaooliveira92/iron-tide/issues/295) must populate `airGroups` and
`airDefenseInstallations` on the campaign battle manifest and call `determineJetCapability` from the
monthly carrier phase. Tracing the state behind each acceptance bullet shows that three of them have
no campaign source, and filling them now would either invent values or expose empty combat.

## Evidence

- **Air groups have no aircraft.** `AircraftNationState.squadrons` (`packages/combat/src/aircraft/state.ts`)
  exists, but `createSquadronState` (`packages/combat/src/aircraft/squadron.ts`) sets
  `operationalAircraftCount: 0` and `missionAvailability: []`, and nothing else writes either field.
  `content/production/1880` contains no aircraft models or squadron content at all. A CAP or strike
  declaration also needs a station position, target id, `speedScore`, fuel and mission phase
  (`packages/combat/src/generation/capabilities.ts`), none of which the campaign snapshot holds.
- **Air defence has no system values.** The only AA content is the `aa_engagement` capability with a
  level of 1 to 3 (`packages/content-schema/src/ship-parts.ts`). `AirDefenseSystemDefinition`
  (`packages/combat/src/air-defense/air-defense-system-definition.ts`) requires layer, category,
  mounts, barrels, ranges, altitude band, target speed limit, arc, profile eligibility, fire control,
  radar, engagement channels, kill/damage/abort/disruption basis points, rate, rounds, magazine,
  local control, saturation group, a content version and a SHA-256 content hash. No ruleset table
  maps a level to those values; `content/production/1880/rulesets.yaml` has only
  `airDefenseSaturationBpBySearchLevel`.
- **Jet capability has no home.** `determineJetCapability` (`packages/combat/src/carrier-operations/jet-capability.ts`)
  takes technology ids (`av_carrier_jet`, `cop_heavy_jet_operations`) plus steep-catapult,
  arresting-gear, lift/hangar, deck-strength/heat and angled-deck predicates. Nothing populates those
  predicates for a ship, and `CarrierOperationsState` has no field for the result; the phase validates
  existing state and returns.
- **The enabling seam is present.** `CompiledDesignVersion.capabilities` is optional and strictly
  decoded (ADR-0308), and `BattleManifest.airGroups` / `airDefenseInstallations` are already optional,
  so the manifest side needs no schema change.
- **Authority.** ADR-0300 keeps air combat, air defence and carrier operations dormant until this
  ticket; ADR-0309 places the AA level-to-effect values in this consumer ticket; ADR-0252 forbids
  inventing unsourced gameplay numbers unless they are recorded as PROVISIONAL balance targets.

## Why agent judgment is insufficient

The choice decides whether the pack gains invented aircraft and AA values or waits for research, and
whether an authoritative carrier/jet state field is added. It also decides whether the E-1 air arc
ships any player-visible effect soon or stays dormant. Each outcome changes authoritative content,
hashes and the scope of the 1940-1970 extension; none is a local design choice.

## Options

### Option A: Research-first, then one air slice

- Behavior: research and author aircraft models and AA system values from sources, then implement
  #295 as one slice (air groups, AA installations, jet capability, ship-type unlocks).
- Advantages: no invented values; one coherent, replay-covered change.
- Risks: #295 stays open until the research lands; carriers remain dormant meanwhile.
- Compatibility impact: additive optional capabilities and manifest fields, no version bump expected.
  Migration impact: none. Scope and effort: a research pass plus one large slice.

### Option B: PROVISIONAL values now

- Behavior: derive a generic air wing from hangar capacity and a level 1-3 AA table, both marked
  PROVISIONAL balance targets, and wire the manifest now.
- Advantages: air and AA run in a campaign battle sooner; the mechanic becomes testable.
- Risks: aircraft speed/range and AA effectiveness are guesses; players see unexplained numbers.
- Compatibility impact: same additive fields. Migration impact: none. Scope and effort: medium.

### Option C: Defer air and AA to the 1940-1970 content arc

- Behavior: leave the ledger rows dormant under ADR-0300, close #295 as deferred to #256/#258's
  engine follow-ups, and spend the frontier elsewhere.
- Advantages: no speculative mechanics; keeps the 1880 experience honest.
- Risks: the explicit next E-1 capability slice produces nothing now.
- Compatibility impact: none. Migration impact: none. Scope and effort: none.

## Recommendation

Option A. The main acceptance bullet, a campaign battle carrying its air groups, needs real aircraft
data; AA values without aircraft still produce empty combat. Research both together, then land #295 in
one slice with the replay and golden evidence it already requires.

## Work safely completed while blocked

- Officer assignment and relief became reachable with engine, command, renderer and running-app
  evidence (35 reachable rows).
- The `ship-readiness` ledger row was corrected from dormant to reachable; the station table and
  readiness commands already existed (35 reachable, 10 dormant-by-decision).
- No air, AA or carrier wiring was attempted.
