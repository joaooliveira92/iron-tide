# Decision Request: Campaign wiring of the unreachable combat modules

## Status

Blocked pending owner decision.

## Trigger

Ticket [#225](https://github.com/joaooliveira92/iron-tide/issues/225) asks for one recorded decision per `combat` module with no campaign hook: wire, dormant by decision, or retire. The reachability ledger (ADR-0267, `docs/reachability-report.md`) already lists seven rows as dormant-by-decision pointing at #225, so the ledger claims a decision that has not been written. Each choice commits roadmap scope (W-1, W-2, W-5, F-3) and decides what the UI may expose.

## Evidence

- Ledger rows citing #225: `aircraft-and-carriers`, `combat-air-combat`, `combat-carrier-operations`, `combat-mines`, `combat-submarines`, `combat-coastal-defense`, `combat-smoke`.
- Mines and submarines are not imported by phase-engine, campaign-engine or the battle resolver (#282). Air combat, coastal defence and air defence have no phase-engine reference; `airGroups` and `airDefenseInstallations` are never populated on a manifest (#280). The monthly carrier-operations phase validates state only.
- `.ai/SPRINT-PLAN.md`: W-2 "Submarines and mines, campaign level" depends on W-1 and wires the built `combat` modules; W-1 depends on S-1 and T-1. Owner decision 0004 (mine inventory) is outstanding and W-2 is off the frontier. W-5 owns invasions; F-3 enables submarine and coastal construction items.
- Decision request 0044 and the E-1 audit (#278 to #283) cover the engine side of aircraft, radar, missiles and ASW for 1940 to 1970.
- ADR-0252: no value is invented; unsourced numbers stay research-first.

## Why agent judgment is insufficient

Wiring a module commits campaign mechanics and unsourced values (mine inventory, ASW rating, air group strength) and changes authoritative outcomes and replay hashes. Retiring a module deletes tested code the roadmap may still need. Which modules the 1880 to 1920 horizon needs, and which wait for the 1940 to 1970 extension, is a product decision.

## Options

### Option A: Wire by roadmap owner, dormant until then

- Behavior: record per module the owner and unblock condition below. Nothing is built now; the ledger rows keep `dormant-by-decision` with a real link.
- Advantages: matches the roadmap, invents no values, closes #225 as a decision.
- Risks: the modules stay unreachable until W-1 lands.
- Compatibility impact: none. Migration impact: none. Scope and effort: one ADR.

| Module                  | Decision | Owner and unblock condition                             | UI must not expose meanwhile                |
| ----------------------- | -------- | ------------------------------------------------------- | ------------------------------------------- |
| mines                   | wire     | W-2, after W-1 and decision 0004 (mine inventory)       | mine orders, mine-laying construction items |
| submarines              | wire     | W-2, after W-1                                          | submarine orders and construction items     |
| coastal-defense         | wire     | W-5 (invasions) and F-3 (coastal items)                 | coastal construction items                  |
| smoke                   | dormant  | needs a tactical player battle (T-2) to matter          | smoke orders                                |
| air-combat, air-defense | dormant  | E-1 engine ticket from #280, with a manifest source     | air groups and AA readouts                  |
| carrier-operations      | dormant  | same ticket as air combat, plus #278 jet-technology ids | carrier and jet-capability readouts         |

### Option B: Retire the air and carrier modules

- Behavior: delete `air-combat`, `air-defense` and `carrier-operations` as unneeded before 1940.
- Advantages: smaller surface.
- Risks: E-1 targets 1940 to 1970 where carriers and air defence are central; the modules and their tests would be rebuilt.
- Compatibility impact: removes exports. Migration impact: none. Scope and effort: small now, large later.

### Option C: Wire everything now

- Behavior: populate air groups, mines and submarines from campaign state in the same slice.
- Advantages: closes the epic fastest.
- Risks: fabricates unsourced values and breaks W-1 ordering; moves every war replay.
- Compatibility impact: hashes move. Migration impact: replay re-approval. Scope and effort: very large.

## Recommendation

Option A. Land one ADR with the table above, repoint the seven ledger rows at it, and keep every module's tests. Mines and submarines go to W-2 once decision 0004 is answered; the air and carrier modules wait for the #280 engine ticket. Do not implement any wiring before approval.

## Work safely completed while blocked

None needed beyond this request. The ledger gate stays green because the rows already classify the modules.
