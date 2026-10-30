# Validation record: agent-session efficiency program (2026-10-29)

Branch: `feat/agent-efficiency` at the commit that adds the tools, instructions, ADR and replay report.
Base: `dev` `62c09438`.

## Commands and results

| Command                                                                              | Result                                                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `pnpm preflight`                                                                     | 53/53 gates successful                                                  |
| `pnpm test:scripts`                                                                  | 436 passed, 0 failed                                                    |
| `pnpm lint`                                                                          | no findings                                                             |
| `pnpm format`                                                                        | all files formatted                                                     |
| `pnpm check`                                                                         | **failed: 16 tests, all in `packages/cross-process-test` replay files** |
| `pnpm --filter @bluewave/compiler-cli exec vp test run test/content-surface.test.ts` | 9/9 passed in isolation                                                 |

## Baseline separation

The `pnpm check` failures are not introduced by this branch. The same tests fail on a pristine `dev` checkout
(`62c09438`, detached worktree, `pnpm install --frozen-lockfile`, `pnpm content:build` first):

| Test file                      | Pristine `dev`        | This branch |
| ------------------------------ | --------------------- | ----------- |
| `test/replay-corpus.test.ts`   | 13 failed / 20 passed | 13 failed   |
| `test/replay-commands.test.ts` | 1 failed              | 1 failed    |
| `test/replay-coverage.test.ts` | 1 failed              | 1 failed    |
| `test/replay-war.test.ts`      | 1 failed              | 1 failed    |

Commands on the pristine base:

```sh
git worktree add .worktrees/base-check 62c09438 --detach
cd .worktrees/base-check && pnpm install --frozen-lockfile && pnpm content:build
pnpm --filter @bluewave/cross-process-test exec vp test run test/replay-corpus.test.ts
pnpm --filter @bluewave/cross-process-test exec vp test run test/replay-commands.test.ts test/replay-coverage.test.ts test/replay-war.test.ts
```

Both runs report the same failure count and the same assertion shape (the re-recorded replay differs from the checked-in
file). The base-check worktree was removed after the evidence was recorded. The branch touches no content, replay,
golden or cross-process file; `git diff --stat 62c09438..HEAD` lists only tooling, docs and the replay report.

The failure is therefore a pre-existing `dev` defect: the checked-in replay corpus no longer matches a fresh recording.
Re-recording it would change authoritative artefacts without an understood cause, which the repository forbids without an
approved re-pin, so it is recorded as a follow-up instead of repaired here.

## Load-related flake

The first `pnpm check` run also failed `content-surface.test.ts` with a 60-second test timeout. At that moment another
checkout was running Electron E2E on the same machine (load average 174, 16 Electron processes), and the test passed in
isolation (9/9) immediately afterwards. The second full run did not reproduce it; all 16 failures were the replay baseline
above. This is recorded rather than waived: the test is timeout-sensitive under shared-machine load, consistent with the
closed issue #218.

## Conclusion

No failing test is caused by this branch. The repository's full gate is red on `dev` for the replay corpus before and
after the change; the branch is otherwise green on preflight, script tests, lint and format, and the focused replay tests
fail identically on the base.
