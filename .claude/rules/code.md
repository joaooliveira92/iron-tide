---
paths:
  - "packages/**"
  - "apps/**"
  - "content/**"
---

# Code

- **Effect** (`effect@4.0.2`, vendored): domain packages use the runtime-free subset; full runtime only at IO boundaries (`persistence`, `compiler-cli`, `desktop/src/main`). Stay in Effect (no `runPromise`); log with `Effect.log*`, never `console.*`; `Context.Service` for stable dependencies. [Gate](../../docs/agents/runtime-free-gate.md).
- **Errors**: `Data.TaggedError` in-process, `Schema.TaggedError` on the wire, stable `_tag`. Discriminate by `_tag`, never `instanceof` (except `expect(fn).toThrow(Class)`); `Effect.catchTag(s)`; `Effect.orDie` only for intentional recovery.
- **Schema and boundaries**: Effect Schema decodes every boundary with `{ onExcessProperty: "error" }`; no `JSON.parse(...) as T`. Wire formats are frozen: schema changes need a parity test from existing fixtures. [Domain](../../docs/agents/domain.md), [patterns](../../agent-patterns/effect-schema.md).
- **Content/compiler**: content is declarative TypeScript compiled to canonical JSON (YAML only for i18n and mandated infra). Stages are explicit, ordered, immutable, accumulate diagnostics; validation, normalization, repair stay distinct; repair is narrow and logged. [Canonical content](../../docs/architecture/canonical-content-and-rulesets.md).
