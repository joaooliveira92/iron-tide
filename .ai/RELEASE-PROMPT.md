# Release and Validation Prompt

> **Superseded (2026-10-10).** The validation gate is now owned by the orchestrator
> (`AGENTS.md`, `.ai/ORCHESTRATION.md`) and `pnpm check`. Kept for historical reference only.

Evaluate the candidate release or compatibility gate without changing authoritative artifacts unless an approved fix is required.

## Required checks

1. Verify clean Git state, branch, tags, lockfile, runtime policy, and package versions.
2. Run frozen installation and all required format, lint, type, architecture, test, build, security, and license checks.
3. Compile canonical fixtures from clean inputs.
4. Verify artifact and snapshot hashes against reviewed expectations.
5. Run save/load continuation and replay verification.
6. Run cross-process checks.
7. At determinism gates, compare Linux, Windows, and macOS results using the pinned Node.js and pnpm versions.
8. Verify migration coverage and rejection behavior for unavailable historical implementations.
9. Verify that no timestamps, paths, locale, timezone, environment, host, PID, or scheduling data affects canonical output.
10. Verify atomic persistence recovery and cancellation cleanup.
11. Run packaged Electron smoke tests after Electron is in release scope.
12. Produce an SBOM or dependency inventory if repository policy requires it.

## Hash-change policy

For each changed canonical artifact report:

- artifact identity;
- old and new hash;
- responsible authoritative change;
- version changed;
- replay and save compatibility;
- migration requirement;
- reviewed fixture regeneration command.

Do not automatically update goldens as a repair.

## Release decision

Return one of:

- `RELEASE_READY`
- `RELEASE_BLOCKED`
- `COMPATIBILITY_GATE_FAILED`

List blockers with exact evidence. Never describe a release as reproducible if the cross-platform evidence was not run or was unavailable.
