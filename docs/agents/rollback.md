# Rollback

Every delivery path here has a rollback that needs no reconstruction of prior
state (ADR-0367 rule 8). Every execution report names the one that applies to
its change.

## A merge into `dev`

```sh
git switch dev && git pull --rebase
git switch -c revert/<slug>
git revert -m 1 <merge-sha>        # or: git revert <sha> for a non-merge commit
pnpm preflight && pnpm test:scripts && pnpm check
```

Merge the revert branch into `dev` like any other change. Never reset `dev` or
force-push. A revert that changes golden or replay hashes is a re-pin and follows
[golden repinning](golden-repinning.md).

Any agent may prepare a revert branch. Merging it follows the same merge
authority as the change it reverts. For a broken `dev`, the brief's owner or the
repository owner decides.

## A release

Releases are tag-triggered (`v*`) and `.github/workflows/release.yml` only ever
creates a **draft** GitHub release. The desktop app has no auto-updater, so no
installed copy changes until a human publishes and a player downloads.

- Bad draft: delete the draft. The tag's build artifacts stay reproducible from the tag.
- Bad published release: mark the previous release as latest, mark the bad one
  as a pre-release with a note, then fix forward on `dev` with a new tag. Do not
  delete or move a published tag.

Publishing, unpublishing and tagging are human actions
([autonomy and access](autonomy-and-access.md)).

## Behaviour that may need switching off

There are no runtime feature flags. Unfinished or risky capability stays
dormant behind the reachability ledger's `dormant-by-decision` status
(ADR-0365 rule 7) until the change that wires it. Switching it off again means
reverting that wiring change.

## Records and drills

- Record each revert as an issue that links the reverted merge and the cause.
- Each quarter, do a revert drill on a throwaway branch: revert a recent merge,
  run the gate, and delete the branch. Record the result in `.ai/reports/`.
