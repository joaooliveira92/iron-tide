# ADR-0274: The frozen `.scratch/` tree is removed

Applies to: repository

## Status

Accepted (2026-10-22). Amends ADR-0227.

## Context

ADR-0227 moved pipeline tracking to GitHub Issues and froze `.scratch/` as tracked
historical provenance. The 205 frozen files no longer feed any build, test, or
gate, and live sources still cited paths inside them.

## Decision

`.scratch/` is deleted from the working tree. Its contents stay recoverable from git
history (`git log --all -- .scratch`). Live sources, configuration, and standing docs
no longer cite it. Accepted ADRs, decision requests, and reports keep their
`.scratch/...` mentions as historical record; they resolve through git history.

## Consequences

- Nothing under `.scratch/` is an authority or a fallback for an unavailable
  canonical document; `.ai/AUTHORITY-INDEX.md` records this.
- The `.scratch/**` ignore patterns in `vite.config.ts` and the `.scratch/handoff/`
  line in `.gitignore` are dropped.
- No change to authoritative gameplay, determinism, saves, or wire formats.
