# ADR-0300: Unreachable combat modules are wired by their roadmap owner and stay dormant until then

Applies to: combat

Rule: Unreachable combat modules stay dormant until their roadmap owner wires them; the UI must not expose them meanwhile.

## Status

Accepted (2026-10-25). Resolves [#225](https://github.com/joaooliveira92/iron-tide/issues/225), taking Option A of
`.ai/decision-requests/0046-unreachable-combat-modules-wire-dormant-or-retire.md`. The owner delegated the choice.

## Decision

No module is retired and none is wired now. Wiring commits campaign mechanics and unsourced values (mine inventory, ASW rating,
air group strength), so it waits for the roadmap item that owns it. Every module keeps its code and tests.

| Module | Decision | Owner and unblock condition | The UI must not expose meanwhile |
| --- | --- | --- | --- |
| mines | wire | W-2, after W-1 and owner decision 0004 (mine inventory) | mine orders, mine-laying construction items |
| submarines | wire | W-2, after W-1 | submarine orders and construction items |
| coastal-defense | wire | W-5 (invasions) and F-3 (coastal items) | coastal construction items |
| smoke | dormant | a tactical player battle (T-2) | smoke orders |
| air-combat, air-defense | dormant | an E-1 engine ticket from #280 that populates air groups and installations on the battle manifest | air groups and anti-air readouts |
| carrier-operations | dormant | the same ticket, plus the remaining technology ids of ADR-0297 | carrier and jet-capability readouts |

The seven reachability-ledger rows that cited #225 now cite this ADR, so the ledger states a recorded decision.

## Compatibility

Documentation and ledger data only. No state, hash or replay changes.
