# G-1 — Artifact inventory, re-baselining and authority index

Sprint report. Executed from commit `e2b10c2` on branch `refactor/comment-prune-sweep-a`.
Status: complete; G-1 execution gate cleared. No implementation sprint started.

Detailed classification and replacement live in [`.ai/AUTHORITY-INDEX.md`](../AUTHORITY-INDEX.md);
this report holds the inventory, the exact commands, and the raw observations.

## 1. Scope and method

Finite, time-boxed investigation per ADR-0210 (DR-010), as specified by the G-1 row in
`.ai/SPRINT-PLAN.md`. For every artifact cited by the README, the workflow prompts, the
historical plan (`43177f4:.ai/SPRINT-PLAN.md`), the decision request, the CI config, the
generator scripts, and the code, the procedure was:

1. `git log --all --full-history -- <path>` (was it ever tracked).
2. `git rev-list --all --objects` (does any object carry the path).
3. `git tag` and `git branch -a` (other refs).
4. `git fsck --no-reflogs` (dangling objects).
5. Historical versions of `.ai/ROADMAP.md`, `.ai/SPRINT-PLAN.md`, `.ai/REQUIREMENTS.md`.
6. `.github/workflows/*` and the generator scripts (`adr-index.cjs`,
   `regenerate-golden-hashes.cjs`, `verify-golden-hashes.cjs`).

Classification vocabulary: recovered, existed under another path, generated and
untracked, aspirational, from another checkout, untraceable.

## 2. Environment and baseline

- Working directory: `/Users/joao/dev/iron-tide`.
- Branch: `refactor/comment-prune-sweep-a`; `HEAD = e2b10c2871dffc82ce8a5b11e8c1381822e3ca24`.
- Working tree clean at start; `git branch -a` = `master`, `refactor/comment-prune-sweep-a`;
  no remote; no tags; `git rev-list --count --all` = 21.
- Baseline gates before changes: `pnpm preflight` exit 0; `pnpm test:scripts` exit 0
  (0 failures); `node scripts/docs-check.cjs` ok (56 links, 0 ADRs indexed);
  `node scripts/verify-doc-budgets.mjs --list` all within ceiling.

## 3. Investigation commands and observations (evidence)

```text
$ git rev-parse HEAD
e2b10c2871dffc82ce8a5b11e8c1381822e3ca24
$ git branch -a
  master
* refactor/comment-prune-sweep-a
$ git remote -v
(none)
$ git tag
(none)
$ git rev-list --count --all
21
$ git fsck --no-reflogs | grep dangling
dangling tree 4401106cc5386a73cc2ea5bf6fa220262df35e17
dangling tree da15e437199867afb0d8cbac45516337fc8544a2
dangling tree d1a8731d779e7a7163f3232a77244f8a38d4c2da
dangling tree 686e7197e8443c15ef8452676d25111c719d0c78
```

Dangling objects: four dangling trees, all alternative repository roots from earlier
index writes. Their `docs/adr` subtree (`7046373…`) is byte-identical to `HEAD`'s and
contains only `AMENDMENTS.md`, `README.md`, and `archive/`; their `.ai` subtrees carry
intermediate versions of the standing docs. No dangling commit or blob yields an
unavailable artifact.

Full-history and object probes:

```text
$ git log --all --oneline --full-history -- <path>
docs/PROGRESS.md            EMPTY
docs/OPEN-ISSUES.md         EMPTY
golden/hashes.json          EMPTY
docs/rules                  EMPTY
docs/domain                 EMPTY
docs/research               EMPTY
.ai/briefs                  EMPTY
.ai/specs                   EMPTY
DESIGN-55                   EMPTY
.scratch/ship-building      EMPTY
docs/acceptance             EMPTY

$ git rev-list --all --objects | grep -F <name>
PROGRESS.md       0 matches
OPEN-ISSUES.md    0 matches
hashes.json       0 matches
docs/rules        0 matches
docs/domain       0 matches
docs/research     0 matches
.ai/briefs        0 matches
DESIGN-           1 match  (.agents/skills/codebase-design/DESIGN-IT-TWICE.md — a skill doc, not a design document)
golden/           2 matches (packages/ship-visual/test/golden/{resolution,placement}-matrix.txt — ship-visual fixtures, unrelated)
```

Recovered-from-history probes:

```text
$ git rev-parse 43177f4:.ai/REQUIREMENTS.md   -> 55530625e275e227f31b80cb1b1a15ea93df1f6b (10404 bytes)
$ git rev-parse 5f19b3d:.ai/REQUIREMENTS.md   -> e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 (0 bytes: emptied)
$ git ls-tree -r --name-only 5f19b3d^ | grep -c scratch  -> 13 (comment-pruning spec + tickets, later dropped)
```

Historical versions read at `43177f4`: `.ai/REQUIREMENTS.md` (179 lines, full
traceability index), `.ai/ROADMAP.md` (53 lines), `.ai/SPRINT-PLAN.md` (513 lines,
references the previous B0-B10 / A-E / P-0..P-6 effort, design docs, ADRs, `.scratch`
efforts, `docs/PROGRESS.md`, `docs/OPEN-ISSUES.md`, and `golden/`).

CI config (`.github/workflows/`): `determinism.yml` uploads and verifies
`golden/hashes.json`; `quality.yml` runs `pnpm check:golden-repin`; the other workflows
reference no unavailable artifact. Generator scripts: `adr-index.cjs` (ADR index and
curated area partition) and `regenerate-golden-hashes.cjs` / `verify-golden-hashes.cjs`
(write and read `golden/hashes.json`).

## 4. Artifact inventory (complete)

Counts across tracked files at `e2b10c2`:

- Distinct `ADR-NNNN` identifiers referenced: **121** (ADR-0001..ADR-0165, plus the
  in-test id `ADR-0200`). ADR files present: **0**.
- Distinct numeric design-document identifiers referenced: **30** (DESIGN-03, 05, 07,
  09, 11, 13, 16, 20, 21, 22, 23, 25, 26, 29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
  42, 43, 44, 45, 55, 57). Design files present: **0**.

Full legacy ADR identifiers referenced (none ever tracked):

```text
ADR-0001 ADR-0002 ADR-0003 ADR-0004 ADR-0007 ADR-0008 ADR-0010 ADR-0019 ADR-0020
ADR-0021 ADR-0022 ADR-0025 ADR-0026 ADR-0028 ADR-0029 ADR-0031 ADR-0032 ADR-0033
ADR-0034 ADR-0035 ADR-0036 ADR-0037 ADR-0038 ADR-0040 ADR-0042 ADR-0044 ADR-0046
ADR-0047 ADR-0048 ADR-0049 ADR-0050 ADR-0052 ADR-0053 ADR-0055 ADR-0057 ADR-0058
ADR-0059 ADR-0060 ADR-0061 ADR-0062 ADR-0063 ADR-0064 ADR-0065 ADR-0066 ADR-0067
ADR-0070 ADR-0072 ADR-0073 ADR-0074 ADR-0075 ADR-0077 ADR-0078 ADR-0079 ADR-0080
ADR-0082 ADR-0083 ADR-0084 ADR-0085 ADR-0088 ADR-0089 ADR-0090 ADR-0091 ADR-0092
ADR-0093 ADR-0094 ADR-0095 ADR-0096 ADR-0098 ADR-0099 ADR-0100 ADR-0101 ADR-0102
ADR-0104 ADR-0105 ADR-0106 ADR-0107 ADR-0108 ADR-0109 ADR-0110 ADR-0111 ADR-0113
ADR-0114 ADR-0116 ADR-0117 ADR-0118 ADR-0119 ADR-0121 ADR-0122 ADR-0123 ADR-0124
ADR-0125 ADR-0127 ADR-0128 ADR-0129 ADR-0130 ADR-0131 ADR-0132 ADR-0133 ADR-0134
ADR-0135 ADR-0136 ADR-0139 ADR-0140 ADR-0142 ADR-0145 ADR-0146 ADR-0147 ADR-0148
ADR-0151 ADR-0152 ADR-0153 ADR-0154 ADR-0155 ADR-0156 ADR-0157 ADR-0159 ADR-0163
ADR-0164 ADR-0165 ADR-0200
```

### Present authorities (identified, not missing)

`README.md`, `RULES.md`, `AGENTS.md`, `CONTEXT.md`/`GLOSSARY.md`,
`.ai/ENGINEERING-CONTRACT.md`, `.ai/ORCHESTRATION.md`, `.ai/AUTONOMOUS-AGENT.md`,
`.ai/IMPLEMENTATION-PROMPT.md`, `.ai/REVIEW-PROMPT.md`,
`.ai/BOOTSTRAP-PROMPT.md` (superseded), `.ai/templates/*`,
`.ai/decision-requests/0001-frontier-artifacts-missing.md`, `.ai/reports/comment-pruning.md`,
`.ai/ROADMAP.md`, `.ai/SPRINT-PLAN.md`, the manual PDF, `docs/architecture/*`,
`docs/agents/*`, `docs/delivery/*`, `docs/DEFERRALS.md`, `docs/adr/*`, `scripts/*`,
`.github/workflows/*`, `.githooks/*`, `vite.config.ts`, `.opencode/agents/*`,
`.opencode/command/*`, `content/production/1880/**`, `packages/**`, `apps/**`,
`vendor/effect`.

### Recovered (existed in reachable history)

- `.ai/REQUIREMENTS.md` — tracked at `43177f4` (blob `55530625`, 10404 bytes), emptied
  at `5f19b3d`. Re-baselined in G-1 with new dates; legacy status claims marked unverified.
- `.scratch/comment-pruning/**` — tracked `c167449`..`5f19b3d`, dropped at `5f19b3d`.
  Deliberately not restored: no tracked authoritative document depends on it.

### Unavailable (never tracked in any reachable object)

Status/process ledgers (`docs/PROGRESS.md`, `docs/OPEN-ISSUES.md`); milestone briefs
(`.ai/briefs/<slug>.md`); the P-2 effort (`.scratch/ship-building/`); the rules tree
(`docs/rules/*`); the domain tree (`docs/domain/*`); acceptance registries
(`docs/acceptance/*`); research notes (`docs/research/*`, legacy); the golden baseline
(`golden/hashes.json`); the 30 design documents; the 121 referenced ADRs; and the
config-referenced `SOURCE-DESIGN-v1.0.md`, `docs/audit/MANIFEST.json`,
`docs/contracts/**`, `docs/requirements/**`, `repos/` (reference material), and
`tools/migrate-dev-saves/main.mjs`. Each has a register row, a classification, a
replacement authority, and a backlog owner in
[`.ai/AUTHORITY-INDEX.md`](../AUTHORITY-INDEX.md).

Special cases:

- `.ai/specs/` exists on disk but is empty and untracked: **generated and untracked**
  (spec index populated on demand).
- `golden/hashes.json` is **generated and untracked**: written by
  `scripts/regenerate-golden-hashes.cjs`, expected by `determinism.yml` and
  `check:golden`. It is not restored; the plan defers the first baseline to Phase 1.
- `ADR-0200-D1` is an in-test `decisionId`, not an ADR file: **untraceable** (in-code).

## 5. Deliverables landed

- `docs/adr/ADR-0201..ADR-0211` — DR-001..DR-011 as new ADR records (new identifiers and
  dates; separate confirmed evidence from new design).
- `scripts/adr-index.cjs` — curated areas re-partitioned to the new corpus; the stale
  legacy-numbering note replaced with a pointer to the authority index.
- `docs/adr/README.md`, `docs/adr/archive/README.md` — regenerated with `pnpm adr:index`.
- `docs/adr/AMENDMENTS.md`, `docs/DEFERRALS.md` — prose corrected for the new corpus.
- `.ai/AUTHORITY-INDEX.md` — authority order, identified authorities, the
  unavailable-artifact register, replacement authorities, and the exit assessment.
- `docs/research/rtw3-manual-baseline.md` — new, source-grounded manual citation map.
- `.ai/REQUIREMENTS.md` — re-baselined; confirmed IDs separated from newly accepted ones.

## 6. Validation results

Run after the changes, from a clean tree:

- `node scripts/docs-check.cjs` — ok (links, anchors, ADR index/status, deferrals,
  amendments).
- `node scripts/verify-doc-budgets.mjs` — within ceiling; `.ai/ROADMAP.md` is 387/400
  words (unchanged).
- `pnpm adr:index` — wrote both indexes.
- `pnpm preflight` — exit 0.
- `pnpm test:scripts` — exit 0.

`pnpm check:golden` (and therefore the full `pnpm check`) remains blocked by the
unavailable `golden/hashes.json`; that is registered and deferred to Phase 1, not
waived.

## 7. Unresolved findings

- `golden/hashes.json` is unavailable; the golden verify cannot run until the Phase-1
  prerequisites are met. Recorded, not blocking G-1.
- The 121 legacy ADR references and 30 design-document references remain in code and
  docs as unverified legacy references; they resolve to nothing and are intentionally
  not edited (out of G-1 scope). Readers follow ADR-0210 to the authority index.
- `package.json`'s `save:migrate` points at the unavailable `tools/migrate-dev-saves/main.mjs`;
  registered under F-4.
- No ADR/DESIGN migration or gameplay semantics were changed.

## 8. G-1 exit assessment

Every later sprint's named dependencies resolve to an identified authority (accepted
decisions, roadmap/plan, manual, tests, production content, implementation, or new cited
research). No later sprint depends on an unidentified document. Unavailable legacy files
no longer block execution.

**G-1 execution gate: CLEARED.**
