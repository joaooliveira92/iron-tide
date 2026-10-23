# Configuration

Docs: <https://effect.website/docs/v4/configuration>.

## Signals

- `process.env`, `import.meta.env`, `Number(process.env`, `parseInt(`, `?? "default"` next to a read.
- `Config.`, `ConfigProvider.`.
- Secrets typed as `string`: tokens, keys, signing material.

## Idioms

- Declare a setting once as a `Config` value: `Config.String("X")`, `Config.NonEmptyString`, `Config.Int`, `Config.Port`, `Config.Number`, `Config.Boolean`, `Config.Duration`, `Config.Literals`, `Config.Array`, `Config.Record`, `Config.Redacted`.
- A custom or structured type: `Config.schema(schema, "NAME")`. A structured schema reads `SERVER_HOST` from the environment and `{ server: { host } }` from an in-memory provider.
- Combine with `Config.all`, default with `Config.withDefault`, make optional with `Config.option`, fall back with `Config.orElse`, group with `Config.nested`, transform with `Config.map` / `mapEffect`.
- Sensitive values are `Config.Redacted`; read with `Redacted.value` at the last moment.
- Pick the source with a provider: `ConfigProvider.fromEnv`, `fromDotEnv`, `fromDir`, `fromUnknown` (tests), `orElse`, `nested`, installed through `ConfigProvider.layer`.
- Read config once while a layer builds, then close over the result.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| Direct `process.env` read | bypass | A `Config` value read in a layer at the edge |
| Hand-parsed number, boolean, or URL from a string | bypass | `Config.Int`, `Config.Boolean`, `Config.schema` |
| Secret held as `string` | leak | `Config.Redacted` and `Redacted.value` at use |
| Config read inside a hot method | leak | Read at layer build; method closes over the value |
| Test mutating `process.env` | bypass | `ConfigProvider.fromUnknown` through `ConfigProvider.layer` |
| `Config.string`, `Config.redacted` | drift | Capitalised v4 names |

## Project

Authoritative packages must not read `process.env`; inputs arrive as validated requests or explicit ports. A `Config` therefore lives at an edge (`apps/desktop/src/main`, `apps/compiler-cli`, `persistence`, `content-compiler`) and passes plain values inward.
