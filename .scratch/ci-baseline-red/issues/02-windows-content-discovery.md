# 02: content discovery is not host-order- or path-separator-independent on Windows

**What to build:** The content-compiler discovery/schema tests must pass on
`windows-latest`. Today five of them fail in the `Determinism Gate`, so the
Windows leg of CI is red on a clean `dev` push — independent of the codemod
build race (ticket 01).

**Blocked by:** None (can start immediately).

**Status:** done (fixed on `fix/windows-content-discovery`).

Evidence — `Determinism Gate` on `windows-latest` at base `ae05b90`
(run 38908691968, job 116998719330), after a full `pnpm build`:

```
test/schemaCoverage.test.ts        (29 tests | 3 failed)
test/manifestAuthority.test.ts    (5 tests | 1 failed)
test/shipBuildingDiscovery.test.ts (2 tests | 1 failed)
Test Files  3 failed | 18 passed (21)
```

Failing assertions (all in `packages/content-compiler/test/`):
- `schemaCoverage` — "rejects a missing/wrong-typed/excess key naming the file
  and field path".
- `manifestAuthority` — "fails when a discovered ship-building file is not
  declared".
- `shipBuildingDiscovery` — "returns host-order-independent groups (INC-1)".

The names point at Windows path-separator (`\` vs `/`) or filesystem-order
assumptions in `packages/content-compiler` discovery. The determinism invariant
(AGENTS.md) forbids host order and platform path separators.

- [x] The three files' failures are diagnosed to their root cause (host path
      separator) with a failing assertion reproduced before the fix.
- [x] Discovery and diagnostics produce POSIX (`/`) content paths on every host;
      a host-separated input never leaks into a comparison, diagnostic or the
      compiled surface (`safePath`/`toPosixPath` in content-compiler; the parse
      stage stores and reports POSIX source paths; `artifactPath` already did).
- [ ] `Determinism Gate (windows-latest)` is green; no other OS regresses.
