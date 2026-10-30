# ADR-0318: ADRs declare the scopes they govern, and each scope's AGENTS.md links its generated index

Applies to: repository

## Status

Superseded by: ADR-0366

Accepted (2026-10-26).

## Context

The ADR corpus is about fifty thousand words. Only two package `AGENTS.md` files cited an ADR, nine packages had no
`AGENTS.md` at all, and the index is grouped by topic, so an agent editing one package had no route to the ADRs that
constrain it other than reading the whole index. One package doc cited ADR-0148, which does not exist. Four ADR numbers are used
by two files each, and a Supersedes or Amended-by relation could be declared on one side only.

## Decision

- Every ADR carries an `Applies to:` line after its title: a comma-separated list of package names, `desktop`, `compiler-cli`,
  `content`, or `repository` alone for repository-wide records.
- `scripts/lib/adr-scope.cjs` generates `docs/adr/by-scope/<scope>.md` for every scope from those lines and the
  `Supersedes` / `Superseded by` / `Amends` / `Amended by` relations. Current records are listed with their `Rule:` line when they
  have one and their title otherwise; superseded records are listed separately with their replacement. `pnpm adr:index`
  regenerates the pages.
- `scripts/verify-adr-scopes.mjs` runs in `pnpm preflight`. It fails when an ADR has no valid scope, a relation is not reciprocated,
  a superseded record carries a `Rule:` line, a scope page is stale, a scope's governing `AGENTS.md` is missing or does not link its
  page, or that `AGENTS.md` cites an ADR that does not exist, an archived or superseded ADR without its replacement on the same line,
  or an ADR whose `Applies to:` omits that scope. `--self-test` proves each failure on the real corpus.
- Governing documents are the package, app and `content/` `AGENTS.md` files and the root `AGENTS.md` for `repository`. A package may
  stay without one only while no ADR applies to it and it is listed in `EXEMPT` in `scripts/verify-package-agents.mjs`; the six packages
  that had ADRs now carry an `AGENTS.md`.
- ADR numbers are unique. Four pairs were duplicated; the files that content and goldens did not cite moved to ADR-0314 to
  ADR-0317 (fleet-management values, research workspace projection, special training, annual fleet exercise). Content notes that
  say ADR-0283, ADR-0290 or ADR-0291 mean the E-1 records, which kept their numbers. Two content references to the
  fleet-management values still read ADR-0283 and are left alone because editing a ruleset note moves the content hash.
- The root `AGENTS.md` ceiling in `scripts/doc-budgets.manifest.json` rises from 1345 to 1375 words for the routing sentence. The
  generated scope pages are not budgeted.

## Compatibility

No product, state or hash change. Scope lines are a reviewed assignment, not a derived fact: a scope that is missing from an ADR
fails the gate, but a scope that is wrong does not, so reviewers check `Applies to:` in each new ADR.
