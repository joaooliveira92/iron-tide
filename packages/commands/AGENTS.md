# @bluewave/commands

**Role:** Command envelopes, the 7-step lifecycle, authorization, ledger, reason codes.

**Class:** runtime-free

**Boundary:** Authoritative, runtime-free. Depends on `campaign`, `ship-design`, `content-schema`; never on `phase-engine` or `combat`.

**Invariants:**

- Every rejection carries a stable reason code and `_tag`.
- Commands are validated requests; no ambient time, randomness or env.

**Governing ADRs:** [every current ADR for this package](../../docs/adr/by-scope/commands.md), with superseded records marked.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Package map: [packages/README.md](../README.md). Test: `pnpm --filter @bluewave/commands test`.
