# Content

Authored game content, compiled by `@bluewave/content-compiler` through
`@bluewave/content-schema` into typed content packs and campaign snapshots
([canonical content and rulesets](../docs/architecture/canonical-content-and-rulesets.md)).

```
content/
  production/
    1880/                 # the 1880 scenario pack
      pack.json           # the one manifest: declares the whole loaded surface
      *.yaml              # nations, areas, ports, routes, fleets, research, …
      ship-building/      # component-level ship data (see its README)
```

`pack.json` is the single authority for the loaded surface: `files` declares the
pack/campaign collections, `shipBuilding` the ship-building subtree. A file
discovered but undeclared, or declared but missing, fails
`content:check`/`content:build`.

- **Authoring a nation** — [adding a nation](../docs/agents/adding-a-nation.md); scaffold with `node scripts/new-nation.mjs`.
- **Ship-building subtree** — [`1880/ship-building/README.md`](production/1880/ship-building/README.md) records its sourced/placeholder values.
- **Source of record** — content values trace to notes under [docs/research/](../docs/research/); keep confidence labels (`VERIFIED` / `ESTIMATE` / `PLACEHOLDER`) in comments.

Content is data, not code: it must not encode mechanics, and localized text must
never control behaviour (`DESIGN-57`).
