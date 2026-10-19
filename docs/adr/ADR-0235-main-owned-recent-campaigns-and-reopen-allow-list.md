# ADR-0235: Main-owned recent campaigns and reopen allow-list

## Status

Accepted (2026-10-19).

## Context

Clicking an entry in Recent Campaigns re-opened the native file dialog, because
the main process must never open a directory just because the renderer names it.
The renderer kept its own recents in `localStorage`, which the main process
could not vouch for and which could drift from what was really on disk.

## Decision

- The main process owns the recents list (`recent-packages.json` in the user-data
  directory, written atomically). It is the single source of truth; the renderer
  holds no copy.
- A package enters the list only after a successful `loadCampaign` through the
  native dialog. Paths are stored canonical (`realpath`) so symlinks and trailing
  separators cannot duplicate or bypass entries.
- `loadRecentCampaign({ packagePath })` opens a package only if its canonical path
  is in the list (`PACKAGE_NOT_APPROVED` otherwise; `PACKAGE_MISSING` when a listed
  directory is gone). `listRecentCampaigns` returns entries with an `available`
  flag; `removeRecentCampaign` forgets one. Payloads are strict-decoded.
- The renderer falls back to the dialog on `PACKAGE_NOT_APPROVED`, shows missing
  packages as unavailable, and keeps load errors visible until dismissed.
- Recording a recent is best-effort: failing to write the list never blocks opening.
- The list is app-shell bookkeeping, never authoritative; the clock comes from the
  injected `Clock` service. The old renderer `localStorage` recents are abandoned
  (they cannot be trusted), so users re-open each package once through the dialog.

## Consequences

- Recents survive restarts and reopen in one click without widening what the
  renderer is trusted to do.
- The list holds at most ten entries; the oldest drop off.
- Verify, Replay and Recover still prompt for a package each time; scoping them to
  a recent package is a separate product decision.
