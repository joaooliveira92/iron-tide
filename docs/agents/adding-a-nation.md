# Adding a nation

Adding a nation is a researched **content** task, not a code task (ADR-0092).
Scaffold a draft, research it, replace every placeholder with a sourced or
explicitly classified value, then let the completeness validator gate it.

## 1. Scaffold

```sh
node scripts/new-nation.mjs <nationId>
```

This writes a draft `NationNavalProfile` skeleton and a research-note stub
**outside** the release content (under `docs/nations/`). Every value is a
`PLACEHOLDER`, so it can never reach release.

## 2. Research and fill

Research the nation into `docs/research/<nationId>-naval-profile.md`, then write
a complete per-nation catalogue file (`{ navalProfiles: [ … ] }`, ADR-0109) that
matches `content/production/<scenario>/ship-building/naval-profiles/<nationId>.yaml`.
Replace every `PLACEHOLDER` with a `VERIFIED`/`DERIVED`/`ESTIMATE` value that
carries a provenance block, or an explicitly classified `BALANCE_TARGET`.

The profile separates **hard capability** (what the nation can build) from **soft
doctrine** (what it prefers); capability can only ever remove options.

## 3. Starters and gates

Author six classified opening starters under
`content/production/<scenario>/ship-building/reference-designs/<nationId>/starters.yaml`.
Then run the completeness validator (`validateNationCompleteness(..., { release:
true })`), which rejects any remaining placeholder or missing provenance. Every
release nation must be complete (see the national-content release gates).

See [`content/README.md`](../../content/README.md) and
[canonical content and rulesets](../architecture/canonical-content-and-rulesets.md)
for the surrounding pipeline.
