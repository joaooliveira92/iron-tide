# Decision Request: Campaign source for air groups and air-defence values

## Status

Resolved as **Option A (research-first)** on 2026-11-05. The owner also decided that CV, CVL and AV
**hold with the air decision**: no `requiresTech` and no `mechanicsImplemented` change until air
content lands, because `SHIP_TYPE_MECHANICS_NOT_IMPLEMENTED` is collected first and independently in
`evaluateShipTypeAvailability`, so adding `requiresTech` alone stacks a second blocking message
without changing what a player can build.

The research pass is published as
[E-1 research: air group, aircraft and AA system value sources](https://github.com/joaooliveira92/iron-tide/discussions/592).
It settles part of this request and returns nine narrower decisions. **Still blocked** on those.

## Trigger

[#295](https://github.com/joaooliveira92/iron-tide/issues/295) must populate `airGroups` and
`airDefenseInstallations` on the campaign battle manifest and call `determineJetCapability` from the
monthly carrier phase. Tracing the state behind each acceptance bullet shows that three of them have
no campaign source, and filling them now would either invent values or expose empty combat.

## Corrections after the research pass

The Evidence section below read the campaign side only and understated both the manual and the
engine. Retained for the audit trail; these are the corrections.

- **The carrier and jet rules are `manual`-grounded and already in the engine**, not missing:
  `CVL_MIN_CAPACITY = 4`, `CVL_MAX_CAPACITY = 34`, `OVERSIZED_CARRIER_THRESHOLD = 100` and
  `ORDINARY_SLOT_CAPACITY_UNITS = 2` (spot value at half capacity) restate pp. 110 and 134, and the
  `determineJetCapability` thresholds of 40 000 000 and 30 000 000 kg restate p. 111. What is missing
  is input data — an aircraft inventory and a non-zero capacity on a real ship — plus the 1.5x jet
  capacity multiplier of pp. 104, 105 and 111, which is sourced and unimplemented.
- **An AA table is geometry, not probabilities.** `createAirDefenseSystemDefinition` defaults every
  effect field (`baseKillBp 100`, `baseDamageBp 50`, `baseAbortBp 30`, `baseDisruptionBp 15`, `rate`,
  `roundsPerEngagement`, `magazineCapacity`, `localControlSupported`, `saturationGroup`, and the
  `fireControl` and `radar` blocks). Only identity, layer, category, mount geometry and range band
  need authoring. Those defaults are a code seam, not balance, so a slice riding them would give every
  ship identical weak AA and fail the Explainable bar.
- **`determineJetCapability` is stricter than its source.** Pp. 110-111 gate jets on displacement, or
  displacement plus steam catapults, and add the angled deck for heavy jets. Arresting gear, deck
  strength and heat resistance, and jet-compatible lifts and hangar appear nowhere as design
  conditions. Three of the six predicates have no source, so that bullet is an engine decision.
- **A fourth gap is code, not content.** `packages/ship-design/src/classification.ts:68` hardcodes
  `aircraftCapacity: 0`, and nothing writes `ship.compiledAircraftCapacity` — the only signal
  `packages/phase-engine/src/carrier-operations.ts:45-48` uses to recognise a carrier. No design can
  classify as CV, CVL or AV whatever the pack contains. The 1880 pack also has no aviation hull type,
  no `aircraft_hangar` part and no AA part, so #295 additionally depends on the E-1 content arc
  (#256, #258) authoring a carrier to put on the manifest.

## Decisions still open

Returned individually in discussion 592 section H: whether `aa_engagement` level 1-3 is a category
ladder or a technology-quality tier; whether AA effect values ship as PROVISIONAL balance targets or
stay dormant under ADR-0300; whether the three ungrounded jet predicates are deleted to match p. 111
or authored; whether the 1.5x jet multiplier enters this slice; squadron size as a ruleset constant;
where the 0-100 aircraft attribute scale is recorded; whether the classifier derivation and the
carrier hull split out as prerequisite tickets; and confirmation that #295 is sequenced behind an
E-1 carrier.

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

Accepted as written on 2026-11-05. The research pass changed the shape of the remaining work: the
carrier and jet rules were already sourced and already in the engine, and the aircraft and AA
magnitudes turn out to be unsourceable rather than unresearched, so discussion 592 section I recommends
narrowing #295 to air groups from capacity plus jets aligned to p. 111, with AA left dormant.

## Work completed while blocked

- Officer assignment and relief became reachable with engine, command, renderer and running-app
  evidence (35 reachable rows).
- The `ship-readiness` ledger row was corrected from dormant to reachable; the station table and
  readiness commands already existed (35 reachable, 10 dormant-by-decision).
- No air, AA or carrier wiring was attempted.
- The Option A research pass is done and published to discussion 592, indexed in discussion 456. No
  pack value was authored from it, so the content lock, the 11 goldens and the 13 replays are
  untouched.
