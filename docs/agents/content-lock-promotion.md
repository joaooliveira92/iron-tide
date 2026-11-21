# Content lock on promotion

The content lock's SHA-256 body hash (`content/production/1880/content-lock.json`) is recorded only on the dev to main promotion. Dev carries no hash: a hash changes with every content change, so it would conflict on every content PR. `pnpm content:verify:release` (Quality Gate, PRs into main) requires the hash; `pnpm content:verify` on dev does not. The `Dev carries no content lock body hash` step in `gates.yml` fails any dev-bound PR that records one.

## Promote

1. Start from a clean checkout and fetch: `git fetch origin dev`.
2. Run `pnpm promote:content-lock --date YYYY-MM-DD` (default: today, UTC). It cuts `promote/<date>` from `origin/dev`, runs `pnpm content:lock`, refuses if any path besides the lock changed, and commits one commit. It does not push, open a PR, or touch `main`.
3. On the branch, run `pnpm content:verify:release` and `pnpm check`.
4. `git push -u origin promote/<date>`, then open a draft PR into `main` from that branch (`gh pr create --draft --base main --head promote/<date>`). A human merges.
5. Never merge `main` back into `dev`: that would put the hash on dev.

If the script fails after the branch is cut, the branch is left for inspection. Delete it with `git switch dev && git branch -D promote/<date>` and re-run.

## Second promotion conflict

The next promotion branch is cut from dev, which has no hash, while `main` already holds the previous one. When content changed, both sides add a different `bodyHash` to the same file and the PR reports a conflict on `content-lock.json`. Resolve on the promotion branch, not on dev:

1. `git merge origin/main` on `promote/<date>`.
2. Keep the promotion branch's side of `content-lock.json` (`git checkout --ours -- content/production/1880/content-lock.json`), then run `pnpm content:lock`.
3. Commit, re-run `pnpm content:verify:release`, and push.

## Why the release test changed

`apps/compiler-cli/test/content-surface.test.ts` used to assert that the committed lock fails release mode. That broke on the promotion branch, which carries the hash. The test now builds a hashless lock in a temp copy, so it holds on any branch; the "dev carries no hash" rule moved to the dev-bound `gates.yml` step.
