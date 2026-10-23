# ADR-0275: The tsgo gate compares pins to the installed toolchain

## Status

Accepted (2026-10-23).

## Context

`scripts/verify-tsgo-integration.mjs` kept a hand-written `TSGO_MATRIX` of the
toolchain versions each `@effect/tsgo` release supports. `@effect/tsgo` embeds that
table in a bundled file and does not export it, and `effect-tsgo patch` (the root
`prepare` step) already fails the install on an unsupported version. The copy drifted:
dependabot bumps merged without updating it and blocked the next push.

## Decision

The gate no longer carries a support matrix. It checks that the root `package.json`
pins for `@effect/tsgo`, `typescript`, `oxlint`, and `oxlint-tsgolint` equal the
installed package versions, and that each patched binary has its `.original` backup.
Compatibility between those versions is enforced by `effect-tsgo patch` at install.

## Consequences

- A tsgo or oxlint bump needs no edit to the gate.
- An unsupported combination fails at `pnpm install`, not at the gate.
- Dependabot groups the four packages together so they move in one pull request.
- No change to authoritative gameplay, determinism, saves, or wire formats.
