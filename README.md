# Bluewave

Bluewave is a deterministic 1880s naval strategy and tactical game — and the
engine and content compiler that produce it. One codebase holds the rules, the
authored content, the campaign simulation, and the Electron desktop app that
plays it. **This file is the binding canonical design baseline**; where a
contract disagrees, the contract wins and this file is fixed in the same change
(see `RULES.md`).

## What it is

A monthly-turn strategic layer (nations, dockyards, fleets, budget, research,
war) drives a deterministic tactical battle resolver. Content is authored in
YAML, compiled into a canonical JSON artifact, and run by the app. The same
content, ruleset, inputs, commands, seeds, and compatibility versions always
produce the same authoritative hashes, on every supported OS.

## Design pillars

- **Determinism.** Authoritative outcomes use integer/fixed-point maths,
  domain-separated RNG, and a canonical serializer. No wall-clock, locale, or
  filesystem-order dependence (`.ai/REQUIREMENTS.md` BW-DET-*).
- **Content is data.** Authored YAML never executes; a manifest declares the
  whole loaded surface, and only the compiled artifact is run.
- **Commands, not mutations.** Intents pass validation, reservation, locking,
  and an explicit resolution outcome, and emit domain events.
- **Phases.** The month advances through an ordered, registered phase pipeline
  with declared read/write footprints.
- **Player first.** The player's experience is the product: the game is
  playable on every merge, decisions are readable, and every number shown
  explains itself.
- **Tune with data.** Gameplay values live in content and balance data, marked
  provisional until sourced or playtested; balance claims cite the generated
  benchmark reports, never intuition.
- **Replay and compatibility.** Saves are content-addressed and refused on a
  version mismatch, never migrated at runtime.

## Repository layout

| Path | What lives there |
| --- | --- |
| `apps/` | Desktop app (`apps/desktop`) and `compiler-cli`. See [apps/README.md](apps/README.md). |
| `packages/` | The engine, one package per concern. See [packages/README.md](packages/README.md). |
| `content/` | Authored game content + the pack manifest. See [content/README.md](content/README.md). |
| `scripts/` | Dependency-light gate/generator scripts. See [scripts/README.md](scripts/README.md). |
| `docs/` | Architecture, delivery, agent guides, and ADRs. Start at [docs/agents/repo-map.md](docs/agents/repo-map.md). |
| `.ai/` | The contract, requirements, roadmap, and orchestration prompts. |
| `vendor/` | Vendored upstream artifacts (read-only reference). |

## Getting started

```sh
pnpm install          # installs deps, wires git hooks, patches the toolchain
pnpm dev              # preflight, then the desktop app + engine dev servers
pnpm preflight        # the gate DAG CI runs
pnpm check            # preflight + format, lint, types, tests, determinism
```

Requirements: Node ≥ 24 and pnpm ≥ 11 (see `package.json` `engines`).

## Where to read next

- `RULES.md` — the binding rules distilled from the authorities below.
- `.ai/ENGINEERING-CONTRACT.md` — engineering standards (the highest code authority).
- [CONTEXT.md](CONTEXT.md) — the domain glossary (one term, one meaning).
- [AGENTS.md](AGENTS.md) — how an agent works in this repo.
- `.ai/REQUIREMENTS.md` — traceable requirement IDs and their evidence.
- `.ai/SPRINT-PLAN.md` — the living backlog (tracks A–E, CONTENT, REL).

## Precedence

1. Safety, legal, credential, and destructive-operation constraints.
2. This canonical design and approved amendments (`.ai/REQUIREMENTS.md`).
3. `.ai/ENGINEERING-CONTRACT.md`.
4. Approved ADRs and compatibility contracts (`docs/adr/`).
5. The current milestone brief.
6. Local conventions and agent judgement.

If two applicable instructions conflict, stop and raise a decision request —
never resolve a gameplay conflict silently. See [AGENTS.md](AGENTS.md) for the
stop conditions.
