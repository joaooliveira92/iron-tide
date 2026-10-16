# 02: content discovery is not host-order- or path-separator-independent on Windows

**What to build:** The content-compiler discovery/schema tests must pass on
`windows-latest`. Today five of them fail in the `Determinism Gate`, so the
Windows leg of CI is red on a clean `dev` push — independent of the codemod
build race (ticket 01).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

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

- [ ] The three files' failures are diagnosed to their root cause (path
      separator and/or directory enumeration order) with a failing assertion
      reproduced before the fix.
- [ ] Discovery produces identical, codepoint-ordered groups on all OSes; no
      `\`-vs-`/` or `readdirSync` order leaks into any comparison or message.
- [ ] `Determinism Gate (windows-latest)` is green; no other OS regresses.
