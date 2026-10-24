# Runtime-free gate

`scripts/assert-runtime-free.mjs` keeps the `effect` runtime out of the pure,
synchronous packages. It is an **allowlist**: an unrecognised `effect` export is a
violation, so a new runtime symbol cannot slip through.

## The rule

Pure packages may import only the runtime-free subset of `effect` — `Schema`,
`SchemaIssue`, `Data`, `Equal`, `Hash`, `Option`, `Predicate`, `Result`. The full
runtime (`Effect`, `Layer`, `Context`, `ManagedRuntime`, fibers, live services) is
allowed only at IO/entrypoint boundaries: `persistence`, `content-compiler`, and
the app surfaces `apps/desktop/src/main` and `apps/compiler-cli`. The desktop
**renderer and preload import no `effect`**.

The guarded roots are listed in `RUNTIME_FREE_ROOTS` in the script (every pure
package plus the renderer-reachable `campaign-engine`). `persistence` and
`content-compiler` are IO boundaries and are deliberately not listed. The `test`
directory of every listed package is guarded too (`RUNTIME_FREE_TEST_ROOTS`);
`phase-engine` is the one exemption until its tests stop importing runtime symbols.

## Running it

```sh
node scripts/assert-runtime-free.mjs             # check the real tree
node scripts/assert-runtime-free.mjs --self-test # run embedded fixtures
```

The check is a pure `findRuntimeImports(file, text) -> findings[]`; it reads no
clock, RNG, environment, or network, so its verdict is deterministic. It runs in
`pnpm preflight` (`gate:runtime-free`, after `gate:runtime-free-self-test`). For
the related single-copy guard, see the single-copy task in `scripts/README.md`.
