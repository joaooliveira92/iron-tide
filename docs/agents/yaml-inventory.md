# YAML inventory and the boundary gate

YAML is deprecated outside internationalization ([ADR-0334](../adr/ADR-0334-deprecate-yaml-outside-internationalization.md)).
The migration completed on 2026-10-29: the ratchet is empty and the gate runs in
strict mode. The machine-readable truth is
[`scripts/data/yaml-boundary.ratchet.json`](../../scripts/data/yaml-boundary.ratchet.json);
the gate is `scripts/assert-no-foreign-yaml.mjs` (`pnpm check:yaml-boundary`,
preflight `gate:yaml-boundary`).

## Inventory (tracked `*.yaml` / `*.yml`, after the migration)

| Category | Files | What it is |
| --- | --- | --- |
| Internationalization | 1 | `content/production/1880/ui/en-US.yaml` — 136 string→string keys, no numeric or domain data |
| Externally mandated infrastructure | 41 | `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/workflows/*.yml` (7), `.github/dependabot.yml`, vendored `.agents/**` (31) |
| Migration debt | **0** | every authored file is now TypeScript; no generated file is YAML |

The 90 authored files that used to be YAML are TypeScript modules:
`content/production/1880/**/*.ts` (89) and `content/ship-visual/parts.ts` (1).
`apps/desktop/electron-builder.yml` became `electron-builder.json`, and the
content codemod stages canonical JSON instead of YAML.

## External mandates, with evidence

| Paths | Owning tool | Why no other format works | Revisit when |
| --- | --- | --- | --- |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | pnpm 11 | workspace membership and the lockfile are only read/written as YAML | never, unless the package manager changes |
| `.github/workflows/**`, `.github/dependabot.yml` | GitHub | workflows and Dependabot config are only read as YAML | never, unless CI moves off GitHub |
| `.agents/**` | vendored third-party skill packages | upstream ships `agents/openai.yaml` and its own `.github` templates | when a skill is upgraded upstream |

## Rules

1. **No new foreign YAML.** A tracked `.yaml`/`.yml` path outside the two allowed
   categories fails the gate, even if the file is otherwise valid.
2. **The ratchet only shrinks.** It is empty now, so any entry added is refused by
   the `--base` growth check that preflight runs against `origin/dev`.
3. **Stale entries fail**, so the ratchet cannot over-count after a migration.
4. **The i18n exception is structural.** Only
   `content/production/<pack>/ui/<locale>.(yaml|yml)` qualifies. A locale file that
   grows gameplay numbers, formulas or component records stops qualifying.
5. **The compiler rejects authored YAML.** `ParseStage` accepts a `.yaml` path only
   for the `ui` group; fixture packs (`type: "fixture"`) are the test-scaffolding
   exception.

## Remaining work

- Converting the inline YAML strings that tests still pass as compiler fixtures
  (`fileContents`) into documents. They never reach a tracked `.yaml` file, so the
  gate does not see them, but they are the last place YAML syntax lives.
- Deleting `content-schema/src/yaml-parser.ts` if the localization catalogue ever
  moves to JSON; until then it is the i18n loader's parser.

## Authoring a new content collection

Author it as a TypeScript module under `content/production/<pack>/` using
`collection`, `list` or `record` from `@bluewave/content-authoring`, declare it in
`pack.json`, and add a line to `content/tsconfig.json`'s includes if it lives outside
the pack root. `pnpm typecheck` covers the whole tree.
