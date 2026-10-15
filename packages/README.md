# Packages

19 standalone TypeScript composite projects. **Authoritative sources:**

- **Boundaries and dependency direction** — [ADR-0001](../docs/adr/ADR-0001-monorepo-structure.md). Read it before adding a package or a cross-package import.
- **Domain vocabulary** — [CONTEXT.md](../CONTEXT.md) (glossary; e.g. `Nation` not "country").
- **Non-negotiable rules** — [`DESIGN-57`](../docs/architecture/non-negotiable-rules.md).

Rules: the graph is directed and acyclic, leaf primitives at the bottom and the
phase engine composing them; import only a package's public `exports`
(`src/index.ts`), never another package's source. Build/test one package with
`pnpm --filter @bluewave/<name> <build|test|typecheck|lint>`.

| Package | Role |
| --- | --- |
| `contracts` | Branded `SafeInt` types, checked arithmetic, rounding. Graph root. |
| `diagnostics` | Structured diagnostic collector with stable codes. |
| `deterministic` | Canonical JSON, SHA-256, hash contexts, envelopes, fixed-point math. |
| `armament` | Platform-independent authoritative armament domain + resolver (ADR-0093). |
| `random` | Domain-separated seeded PRNG with an audit ledger. |
| `content-schema` | Effect `Schema` definitions + safe YAML parser for packs, rulesets, entities. |
| `content-compiler` | Parse → validate → normalize → compile stages with diagnostics. |
| `campaign` | Campaign compiler and state aggregates (world, nations, fleets, war…). |
| `ship-design` | Component-level ship compiler (DESIGN-21/63). |
| `ship-visual` | Presentation-only ship visual parts: era/nation part catalog, resolver, placement (ADR-0148). Renderer-only. |
| `commands` | Command envelopes, 7-step lifecycle, authorization, ledger, reason codes. |
| `events` | Domain event envelopes, explanation trees, ledger. |
| `combat` | Deterministic tactical battle engine and auto-resolution. |
| `ai` | Legal-only uniform-random AI planning via keyed RNG. |
| `persistence` | Content-addressed atomic save/load, snapshots, recovery. |
| `phase-engine` | Ordered monthly turn pipeline (17 phases), replay verifier, ledger. |
| `campaign-engine` | Desktop read-only projections + the `campaign:execute` bridge. |
| `test-support` | Fixture helpers and valid/invalid definitions. |
| `cross-process-test` | Cross-process determinism proof harness. |

Applications live in [apps/](../apps/README.md).
