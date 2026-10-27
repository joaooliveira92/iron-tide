# @bluewave/ai

**Role:** Legal-only uniform-random AI planning via keyed RNG.

**Class:** runtime-free

**Boundary:** Authoritative planning; draws only through the random package's domain-separated streams.

**Invariants:**

- Plan only commands the engine accepts as legal; never read `Math.random`.
- Outcome changes move goldens: follow golden repinning.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/ai.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/ai test`.
