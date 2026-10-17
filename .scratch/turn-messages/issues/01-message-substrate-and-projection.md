# 01: Message substrate and projection

**What to build:** A new runtime-free `@bluewave/messages` package that turns a month's authoritative domain events into structured, player-facing messages. It owns the `TurnMessage` record, `EntityReference`/`EffectReference`, a pure versioned projection policy, provenance, canonical ordering, aggregation, and deduplication. Given the domain events the economy, construction, research, and diplomacy phases already emit, it produces severity- and category-tagged messages with links to the ships, classes, nations, regions, technologies, projects, and formations involved. `TRACE` messages are developer-only and never appear in player output. Nothing renders yet — this is the pure, testable core that every later ticket builds on.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A strict `TurnMessage` schema (and its entity/effect references) rejects excess keys on decode.
- [ ] The projection is a pure, total, deterministic function of `(domain events, snapshot, projection inputs)`, carries a declared projection version, and uses canonical ordering — no ambient time, locale, randomness, or renderer state.
- [ ] Routine events aggregate under a stable aggregate key; deduplication uses a stable key; critical outcomes (sunk ship, completed ship, war/peace, breakthrough, battle, mandatory decision, severe financial failure) are never merged away.
- [ ] `TRACE` messages are excluded from player-visible output.
- [ ] Messages retain provenance back to their source domain-event ids, turn id, and rules/content versions.
- [ ] Unit and schema-parity tests cover strict decode, totality, ordering, aggregation, and deduplication.
