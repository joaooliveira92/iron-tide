# ADR-0350: E-1 1940-1970 content and values

Consolidates: ADR-0283, ADR-0284, ADR-0290, ADR-0291

Applies to: content, cross-process-test, ship-design

Rule: Every authored technology, ship class, and part value for the 1940-1970 period must trace to a cited source or be labelled BALANCE_TARGET with a documented derivation; content must never promise behaviour the engine lacks.

## Status

Accepted (2026-10-30).
Supersedes: ADR-0283
Supersedes: ADR-0284
Supersedes: ADR-0290
Supersedes: ADR-0291

## Context

The authored horizon (ADR-0348) extends to 1970, but content originally stopped at 1939. The E-1 milestone fills the 1940-1970 gap with technology, ship classes, parts, and values. These decisions record the owner's approval of recommendations in decision requests 0040 and 0041, and the implementing agent's delegated choices for cruiser and destroyer values, all under the standing delegation of unsourced values.

The research note `docs/research/e-1-1940-1970-timeline.md` and the audit `.ai/reports/e-1-era-mechanics-audit.md` provide the evidence base. Every value that lacks a direct source is labelled `BALANCE_TARGET` with its derivation from the nearest existing part or form in the same family.

## Rules

### 1. Research fields for new eras

Radar, missiles and aviation get their own research fields using the canonical vocabulary already declared in `content-schema` `research-fields.ts`: `RADAR_AND_ELECTRONICS`, `MISSILES`, `AVIATION`, `CARRIER_OPERATIONS`. National profiles gain priorities for the fields the pack starts to use.

### 2. Date policy

The `historical-analogue` year in the research note is each technology's year, labelled `BALANCE_TARGET`, with community anchors (1944 carrier jets, 1947 heavy SSM conversions, 1950 angled decks, 1952 jet refit and steam catapult, 1955 ASW sonar, 1959 quadruple heavy SSM, 1960 cruise missiles, 1966 quadruple medium SSM) overriding where both exist.

### 3. Technology years

Every candidate in the research note is accepted at its stated year, except `DAMAGE_CONTROL` adds nothing for 1940-1970. The helicopter hangar is dated 1955 as a balance target because sources pin only the decade.

### 4. Ship classes

Fleet carrier (jet), escort carrier, guided-missile destroyer and frigate, ASW corvette and frigate, missile corvette and fast attack craft, and guided-missile cruiser all enter, each dated by the technology it requires.

### 5. Cost and weight derivation

Each cost and discovery weight is a `BALANCE_TARGET` derived from the nearest existing technology in the same field, labelled with provenance kind `balance_adjustment` (ADR-0213), and recorded with its derivation.

### 6. 1940-1949 ship and part values

- **Torpedo.** The 21-inch acoustic homer is the US Mark 35 (1949), the only one for surface tubes. It requires `torp_acoustic_homing`; the part is dated 1949 while the technology stays 1943. Fleet torpedoes before 1949 use existing 21-inch parts.
- **Missing 1930s guns.** The 5-inch/38 (1934) and 6-inch/47 DP (1948) enter with the 1940s set. The 5-inch gun is not gated on the 1945 technology; the twin mount is.
- **Loading label.** `gun_auto_loading_turret` keeps its name. The 8-inch/55 mount requires it; the 6-inch/47 DP mount requires `gun_dp_rapid_5in`.
- **Unsourced values.** Each unsourced value is a `BALANCE_TARGET`, copied or scaled by mass or calibre from the nearest existing part of the same family, with derivation in its note. Hull coefficients reuse the nearest existing form.
- **Welded hull.** No schema key is added. `hc_all_welded_hull` stays a gate with no weight effect.
- **Plant pressure.** The steam plant records 650 psi (Naval Historical Review) and notes the 600 psi disagreement.
- **Classification by era.** `balance.yaml` gains an optional `classificationFromMonth` list. The 1940 entry raises only the destroyer and light-cruiser boundary to 4,000 t; every other threshold repeats the base.
- **Fitted values.** The destroyer form's `formBp`, Admiralty coefficient, and the steam plant's mass, volume and fuel curve are `BALANCE_TARGET` values fitted so the Gearing reference closes on its sourced values.

### 7. 1940-1949 cruiser values

- **Reference ships.** The Worcester (light cruiser) and Des Moines (heavy cruiser) are the 1948 United States starters. Both close on their sourced full-load displacement and 33 kn.
- **Hull forms.** `light_cruiser_form` and `heavy_cruiser_form` with fitted `formBp` and Admiralty coefficient; all `BALANCE_TARGET`.
- **Guns.** `gun_dp_6in_47_twin` (requires `gun_dp_rapid_5in`) and `gun_ap_8in_55_triple` (requires `gun_auto_loading_turret`), both dated 1948, both `MAIN_GUN`.
- **Classification.** From 1940, light cruisers may reach 19,000 t with a belt up to 6 inches. A light cruiser stays defined by guns of 6 inches or less.
- **Yard.** `yard_large` admits 230 m and a 500 t crane lift. United States practical displacement reaches 25,000 t from 1940.
- **Triple turrets.** The part-model migration reclassifies every mount of three or more barrels as a broadside central battery (D17). This is a known mismodelling; a native multi-gun turret path is follow-up work.
- **Not authored.** Light cruiser anti-aircraft guns, radar and fire-control directors wait for engine support; starters carry the optical rangefinder only.

### 8. 1950-1959 destroyer values

- **Reference ship.** The Forrest Sherman (DD931) is the 1955 United States starter.
- **Gun.** `gun_dp_5in_54_single` (1954, requires `gun_dp_rapid_5in`), following the conventions of Rule 6.
- **Hull form.** `postwar_destroyer_form` with fitted coefficients, all `BALANCE_TARGET`.
- **Classification.** From 1950 a destroyer may displace up to 6,000 t and a light cruiser starts at 6,000 t; both `BALANCE_TARGET`.
- **Range.** The model returns 1,725 nm at 20 kn, asking for 1,500 nm instead of claiming the sourced 4,500 nm figure.
- **Not authored.** The 76 mm twin AA mounts, 324 mm ASW tubes, Hedgehogs, and every carrier, missile, ASW and radar ship of 1950-1970 need part families the part model lacks and combat models the campaign battle path does not reach. Content must not promise behaviour the engine lacks, so ticket #258 (1960-1970 ships) and the remainder of #256 wait on those follow-ups.

### 9. Provenance discipline

No value is unlabelled or claims a source it does not have. Each authored technology records its class, citation or anchor, and derivation. Engine support for new capabilities is audited separately; content never promises behaviour the engine lacks.

## Consequences

- No value is unsourced and unlabelled. Each authored technology records its class, citation or anchor, and derivation.
- Part, design and placement pins move with each slice; replays differ only in the recorded content hash.
- Tickets #253 to #258 are unblocked by the field decisions.
- The base is thinner than initially assumed: the ship-building pack authors 1880-1899 only, so the 1940s set needs national profiles opened for the nations that get the content.
- Engine support for the new capabilities is audited separately (issue #259).