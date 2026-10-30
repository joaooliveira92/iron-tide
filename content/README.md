# Content

Authored game content, compiled by `@bluewave/content-compiler` through
`@bluewave/content-schema` into typed content packs and campaign snapshots
([canonical content and rulesets](../docs/architecture/canonical-content-and-rulesets.md)).

```
content/
  production/1880/
    pack.json           # the one manifest: declares the whole loaded surface
    ui/en-US.yaml       # the only permitted YAML: a localization catalogue
    *.yaml              # in migration (see the ratchet)
    ship-building/      # component-level ship data; guns/french.ts is migrated
```

`pack.json` is the single authority for the loaded surface. A file declared but
missing, or discovered but undeclared, fails `content:check`/`content:build`.

- **Authoring a nation** — [adding a nation](../docs/agents/adding-a-nation.md).
- **Ship-building subtree** — [`1880/ship-building/README.md`](production/1880/ship-building/README.md).
- **Source of record** — values trace to [docs/research/](../docs/research/); confidence is typed provenance data, not comments.

YAML is deprecated outside localization ([inventory](../docs/agents/yaml-inventory.md),
Every remaining `.yaml` is listed in the shrinking
[ratchet](../scripts/data/yaml-boundary.ratchet.json); `pnpm check:yaml-boundary`
fails on a new one. Content is data, not application code: it must not encode
mechanics, and localized text must never control behaviour (`DESIGN-57`).
