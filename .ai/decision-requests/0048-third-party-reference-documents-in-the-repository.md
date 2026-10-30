# Decision Request: Third-party reference documents committed to the repository

## Status

Blocked pending owner decision.

## Trigger

Audit finding MONO-008 (`docs/audits/monorepo-audit.md`). Three third-party documents are tracked:
`docs/Rule the Waves 3 Manual EBOOK.pdf` (about 13 MB), `docs/research/Steam Community __ Guide __ Ship Design Guide (1890 to 1970).mhtml` (about 4.7 MB) and `docs/campaign-review.mhtml`. Their redistribution rights are not recorded anywhere in the repository. Removing them from history would rewrite history, which repository policy forbids without approval.

## Evidence

- ADR-0210 names the RTW3 manual as an authority source, and ADRs cite it by page (for example "manual p.48"), so deleting the file removes the provenance behind those citations.
- No licence note, `NOTICE` or permission statement covers these files (`pnpm check:licenses` covers npm dependencies only).
- Together they are the largest tracked files outside `vendor/`, and every clone carries them.

## Why agent judgment is insufficient

Whether the project may redistribute a commercial manual and a community guide is a legal and product decision. Removing them changes the authority trail; keeping them may be an infringement risk once the game ships.

## Options

### Option A: Keep, and record the basis

- Behavior: add a licence/permission note next to the files and a gate entry so new third-party documents need one too.
- Advantages: provenance intact; no history change.
- Risks: leaves the redistribution risk if rights are not held.
- Compatibility impact: none.
- Migration impact: none.
- Scope and effort: small.

### Option B: Untrack going forward, keep local copies

- Behavior: `git rm --cached` the files, ignore them, keep ADR page citations, and document where the owner keeps the originals. History keeps the old blobs.
- Advantages: stops further distribution from new clones' working trees and from later commits; no rewrite.
- Risks: history still holds the blobs; page citations point to a file contributors must obtain themselves.
- Compatibility impact: docs-check links to these files must become plain text.
- Migration impact: small.
- Scope and effort: small.

### Option C: Untrack and purge from history

- Behavior: Option B plus a history rewrite.
- Advantages: removes the content entirely.
- Risks: rewrites shared history, invalidates every clone and worktree.
- Compatibility impact: breaks open branches.
- Migration impact: large.
- Scope and effort: large.

## Recommendation

Option A if the owner holds or can obtain permission; otherwise Option B. Option C only on legal advice.

## Work safely completed while blocked

None changed in the tree. The finding is recorded in the audit report.
