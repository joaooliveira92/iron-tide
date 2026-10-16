# 01: codemod-determinism preflight gate must build its dependencies first

**What to build:** `pnpm preflight` must pass in a fresh checkout, before any
`pnpm build`, on every OS. Today `gate:codemod-determinism` runs
`packages/content-codemod` tests that import workspace packages whose published
entry is their built `dist/`, and the preflight gates run in parallel, so on a
clean checkout the gate loses the race to whatever builds and fails.

**Blocked by:** None (can start immediately).

**Status:** done (fixed on `fix/ci-prebuild-codemod-determinism`).

Reproduced at the untouched base `ae05b90`:

```
pnpm preflight
# Error: Failed to resolve entry for package "@bluewave/ship-design".
#   The package may have incorrect main/module/exports specified in its package.json.
# Error: Command failed: pnpm exec vp test run --reporter=verbose test/determinism.test.ts test/publish.test.ts
```

Local reproduction (remove the built output and run the gate directly):

```
rm -rf packages/ship-design/dist packages/content-schema/dist
node scripts/verify-codemod-determinism.mjs
# Error: Failed to resolve entry for package "@bluewave/content-schema"
```

Fix: `scripts/verify-codemod-determinism.mjs` builds the package's dependency
closure (`pnpm --filter @bluewave/content-codemod... build`) before running the
test processes, so the gate is self-contained regardless of scheduling.

- [x] The gate builds `@bluewave/content-codemod` and its dependencies first.
- [x] In a fresh checkout with no `dist/`, `node scripts/verify-codemod-determinism.mjs`
      passes (tree sha256 printed, two processes byte-identical).
- [ ] CI `Quality` and `Gates (cross-OS)` are green on a clean `dev`.
