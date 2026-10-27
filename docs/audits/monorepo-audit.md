# Bluewave monorepo audit

Audit date: 2026-10-27. Branch audited: `dev` at `2a783f45`. No production code was changed.
Method: static inspection of manifests, configs, CI, scripts and source, plus the
lightweight baseline gates. The full `pnpm check` was **not** run (see section 3).

## 1. Executive summary

**Overall health: strong.** The repository enforces an unusually large set of its own
rules mechanically (51 preflight gates, each with a self-test fixture, plus 410 gate
tests). Determinism, single-copy `effect`, boundary decoding, tagged errors, golden hashes
and replay corpora are gated, not just documented. The remaining risks are at the edges
the gates do not yet reach: the Electron shell hardening, CI coverage on the integration
branch, and manifest/graph drift.

**Strengths**

- Gate DAG in `vite.config.ts` with `--self-test` fixtures for each gate.
- No dependency cycles across 21 packages; `contracts` and `deterministic` are the
  highest fan-in leaves, as intended.
- `contextIsolation: true`, `nodeIntegration: false`, a narrow named preload API, and
  schema-decoded IPC payloads.
- All GitHub Actions pinned by commit SHA, least-privilege `permissions`, signing secrets
  scoped to the single packaging step, release ref verification.
- Exact-pinned toolchain, `workspace:*` enforcement, license check, frozen installs.
- Cross-OS determinism matrix, golden-repin ratchet, CI/`pnpm check` parity gate.

**Main risks**

1. Electron navigation/popup/permission controls required by the contract are absent (MONO-001).
2. The production CSP may not be applied to the `file://` renderer, and nothing tests it (MONO-002).
3. With local merges into `dev` (ADR-0234), `dev` has little CI-enforced testing (MONO-003).

**Five highest-leverage opportunities**

1. MONO-001: add `setWindowOpenHandler`, `will-navigate`, permission handlers (small).
2. MONO-002: verify and test the effective CSP; add a `<meta>` fallback (small).
3. MONO-004: make `package.json` deps, tsconfig references and real imports agree via a gate (medium).
4. MONO-003: run the fast test tier on pushes to `dev` (small to medium).
5. MONO-006: add secret scanning and static analysis to CI (small).

**Do first:** MONO-001 and MONO-002. They are security-contract gaps in shipped code, small,
independent, and cheap to verify. Then MONO-009 and MONO-010 as zero-risk quick wins.

## 2. Repository map

### Workspace inventory (21 packages + 2 apps, all `private`, versions `0.0.0`, except desktop `4.0.0`)

| Layer | Packages | Role (confirmed from manifests/imports) |
| --- | --- | --- |
| Foundation | `contracts`, `diagnostics`, `deterministic` | shared types, diagnostics, hashing/canonical serialization (`@noble/hashes`) |
| Content | `content-schema`, `content-compiler`, `content-codemod`, `armament`, `ship-design`, `ship-visual` | schemas, staged compiler, codemods, ship parts/design, generated visual catalog |
| Simulation | `random`, `events`, `messages`, `campaign`, `campaign-engine`, `commands`, `combat`, `ai`, `phase-engine` | authoritative state, commands, RNG, combat, AI, month/phase orchestration |
| IO | `persistence` | saves and migrations (full Effect runtime allowed) |
| Test infra | `test-support`, `cross-process-test` | fixtures; child-process determinism, replay corpus CLI |
| Apps | `apps/compiler-cli`, `apps/desktop` | CLI over the compiler/engine; Electron app (main, preload, renderer, shared) |

Dependency direction (declared deps, no cycles): apps → `phase-engine` → (`ai`, `combat`,
`campaign-engine`, `commands`, `persistence`, `messages`) → `campaign` → (`content-compiler`,
`ship-design`, `armament`) → `content-schema` → `diagnostics`/`deterministic` → `contracts`.
`campaign` depending on `content-compiler` is notable: the simulation state package depends on
the compiler package.

Runtime: Electron `main` (Effect `ManagedRuntime`, IPC handlers in
`apps/desktop/src/main/index.ts`) ↔ `preload` (`contextBridge`, `apps/desktop/src/preload/index.ts`) ↔
`renderer` (React, no `effect`). Content ships as a compiled artifact in `extraResources`.

Build/test/release: `vp run -r build` (`tsc -b` per package), `vp test run` per package
(430+ files in desktop alone), Playwright E2E, `pnpm check` (about 25 serial steps) wrapped by
`scripts/heavy.mjs`. CI: `gates.yml` (3 OS), `quality.yml` (PRs into `main`),
`determinism.yml` (PRs, nightly), `desktop-e2e.yml` (macOS, includes packaged smoke),
`commit-convention.yml`, `release.yml` (tag, signed mac/win, linux, draft release).

Areas not covered by enforceable policy: see MONO-001 to MONO-007.

## 3. Baseline validation

| Command | Result | Duration | Notes |
| --- | --- | --- | --- |
| `pnpm preflight` | exit 0 | 38 s | `vp run: 51/51 successful`. Run directly, not via `heavy` (see below). |
| `pnpm test:scripts` | exit 0 | 11 s | 410 pass, 0 fail, 0 skipped. |
| `pnpm audit --prod --audit-level=high` | exit 0 | 6 s | 2 moderate: `@vitest/browser` and `@vitest/ui` (GHSA-p458-7748-mcp3) via `vendor__effect-vitest>vitest`. Dev tooling only; below the CI threshold. |
| `node /tmp/audit/graph.mjs` (throwaway script, not committed) | n/a | <1 s | Import/manifest/tsconfig cross-check and cycle detection: no cycles; drift in MONO-004. |

**Not run:** `pnpm check` (format, lint, `lint:effect`, typecheck, build, full tests, heavy
suites, golden, determinism, E2E), `pnpm check:balance-reports`, `pnpm test:e2e`, packaged
smoke, installing with `--frozen-lockfile`. Reason: another session on this machine held the
`heavy` lock with a running `pnpm check:steps` and load average was above 25; the repo policy
is to serialize these. My own queued `heavy pnpm preflight` was cancelled in favour of a direct
run because preflight consists of light node scripts. Baseline of the heavy tier is therefore
unknown. Working tree after the runs: only the audit documents are untracked.

## 4. Findings

Legend: Impact / Effort / Confidence / Scope. QW = quick win.

### MONO-001: No navigation, popup or permission controls in the Electron main process
- **Priority** P1. **Category** Security / Electron boundary. **Impact** high. **Effort** small. **Confidence** confirmed. **Scope** local. **QW:** yes.
- **Affected:** `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/shellPolicy.ts`.
- **Evidence:** a search of non-test code in `apps/desktop/src` for `setWindowOpenHandler`, `will-navigate`, `setPermissionRequestHandler`, `setPermissionCheckHandler`, `will-attach-webview` and `shell.openExternal` returns no matches. `.ai/ENGINEERING-CONTRACT.md` (Electron boundary) requires "restrictive navigation, popup, and Content Security Policy controls".
- **Current behavior:** the window uses Electron defaults: any `window.open` creates a new window with the same preload, any navigation is allowed, and all permission requests use defaults.
- **Why it matters:** the preload exposes `campaign:execute` and preference writes. A navigation or popup to unexpected content (a dependency rendering an `<a target=_blank>`, a bug) would inherit that bridge.
- **Root cause:** the contract rule has no gate and no test.
- **Remediation:** deny all `window.open` (`setWindowOpenHandler` returns `{ action: "deny" }`); in `will-navigate` only allow the app origin (dev URL in dev, the packaged file URL otherwise); deny all permission requests and checks; set `webviewTag` to false explicitly. Put the pure predicates in `shellPolicy.ts` where they are unit-testable.
- **Plan:** (1) write predicate tests in `shellPolicy.test.ts`; (2) implement predicates; (3) wire in `createWindow`; (4) add an E2E assertion that `window.open` and `location.href = "https://example.com"` do not navigate.
- **Acceptance:** all three handlers installed, covered by unit and E2E tests; no change to normal flows.
- **Validation:** `pnpm --filter @bluewave/desktop exec vp test run src/main/shellPolicy.test.ts`; `pnpm test:e2e`.
- **Risks:** dev server URL and `file://` origin comparison must be exact; verify with `pnpm snap`.
- **Ordering:** independent. Pairs with MONO-002 and MONO-007.

- **Implementation status (2026-10-27, branch `fix/electron-shell-hardening`): implemented.** `apps/desktop/src/main/shellGuards.ts` denies renderer-created windows, cancels `will-navigate`/`will-redirect`/`will-attach-webview` to anything but the packaged entry (or the exact dev origin in development), and denies permissions except `clipboard-sanitized-write` from a trusted requester; installed once on `web-contents-created`, so recreated windows add no listeners. Tests: `shellGuards.test.ts` (30), `e2e/shell-security.spec.ts` (fails without the change), and the packaged smoke. Recorded in ADR-0320. Residual: `javascript:` navigations are covered by the pure predicate, not observed at runtime (Electron emits no `will-navigate` for them); Windows and Linux not exercised.

### MONO-002: Production CSP is delivered only through a response-header hook and is untested
- **Priority** P1. **Category** Security. **Impact** high. **Effort** small. **Confidence** medium (needs a runtime check). **Scope** local. **QW:** yes, once verified.
- **Affected:** `apps/desktop/src/main/csp.ts`, `apps/desktop/src/main/index.ts:111-115`, `apps/desktop/src/renderer/index.html`.
- **Evidence:** `index.html` has no `Content-Security-Policy` meta tag (only charset and viewport). The packaged app loads with `win.loadFile(...)`, so the only CSP source is `session.webRequest.onHeadersReceived`. No test under `apps/desktop/e2e` or `scripts` asserts that a policy is effective (the only match for "CSP" is a comment in `scripts/packaged-smoke.mjs`).
- **Current behavior:** unknown whether `file://` loads receive the injected header. The policy itself (`default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`) lacks `object-src`, `base-uri`, `frame-ancestors` and `form-action` (the first two are not covered by `default-src` fallback for `base-uri`/`form-action`).
- **Why it matters:** if the header is not applied to file loads, the shipped app has no CSP at all.
- **Root cause:** the policy is configured but its effect is never observed.
- **Remediation:** first measure: in the packaged smoke, read the `securitypolicyviolation` behaviour or `document.querySelector` an injected inline script and assert it is blocked. If not applied, add a build-time `<meta http-equiv>` CSP to `index.html` (also covers dev parity) and keep the header hook. Add `base-uri 'none'; form-action 'none'; object-src 'none'`.
- **Acceptance:** an automated test fails if the production policy is not enforced; policy includes the missing directives.
- **Validation:** `pnpm snap`, `pnpm --filter @bluewave/desktop run smoke:packaged`, `pnpm test:e2e`.
- **Risks:** tightening may block inline styles used by libraries (`style-src` stays). Check the console via `pnpm snap`.
- **Ordering:** independent; do alongside MONO-001.

- **Implementation status (2026-10-27): partly refuted, hardened.** A probe of the built app over `file://` (and later the packaged binary) reports `script-src-elem`, `script-src` and `connect-src` violations, so the header hook **does** reach the `file://` renderer; the "may not be applied" hypothesis is refuted. The confirmed gap was the policy content: `base-uri` was open (a `<base>` rewrote relative URLs to `https://example.com`). `csp.ts` now declares `script-src`, `connect-src`, `font-src` explicitly and `object-src`, `base-uri`, `form-action`, `frame-ancestors` as `'none'` in production and development. No meta tag was added (two sources would intersect). Tests: `csp.test.ts`, `e2e/shell-security.spec.ts` (including a no-violation new-campaign flow), packaged smoke. **Residual exception:** `style-src 'unsafe-inline'` remains because `GlobeShell.tsx` and `gradient-background-text.tsx` render inline `<style>` elements (ADR-0320).

### MONO-003: The integration branch has almost no CI-enforced testing
- **Priority** P2. **Category** Delivery / governance. **Impact** high. **Effort** small to medium. **Confidence** high. **Scope** repository-wide.
- **Evidence:** `quality.yml` runs only for PRs into `main`. `determinism.yml` triggers on `pull_request`, dispatch and nightly (the schedule only fires once the file is on `main`, as its own header says). Pushes to `dev` run `gates.yml`, `commit-convention.yml` and `desktop-e2e.yml` (path-filtered). `AGENTS.md` makes PRs optional and delivery is a local merge into `dev` (ADR-0234).
- **Current behavior:** unit tests, typecheck, golden hashes and the Windows/macOS determinism matrix do not run on a push to `dev`; they depend on the author running `pnpm check` locally and on the `dev` to `main` promotion PR.
- **Why it matters:** a regression or a platform-specific hash difference is found at promotion time, with many commits to bisect.
- **Root cause:** deliberate cost trade-off (heavy tier only at promotion) that has no compensating push trigger.
- **Remediation:** add `push: branches: [dev]` to `determinism.yml` (Ubuntu only, per its plan job) and run the fast tier (`pnpm typecheck`, `pnpm test:run`, `pnpm check:golden`) on pushes to `dev`. Keep the cross-OS matrix for `main` and nightly.
- **Acceptance:** a push to `dev` that breaks a unit test or golden hash turns a workflow red.
- **Validation:** push a throwaway branch named to trigger via `workflow_dispatch` first. The parity gate runs in `pnpm preflight`.
- **Risks:** runner minutes; mitigated by the existing Vite Task and Vitest caches in `quality.yml`.
- **Ordering:** independent. Decision needed on cost.

### MONO-004: Manifest dependencies, tsconfig references and actual imports disagree
- **Priority** P2. **Category** Package boundaries / dependency management. **Impact** medium. **Effort** medium. **Confidence** confirmed. **Scope** multi-package.
- **Evidence (from a throwaway script, then spot-checked with grep):**
  - Declared but not imported anywhere in the package (only `package.json` mentions it): `content-compiler`→`contracts`; `deterministic`→`contracts`; `diagnostics`→`contracts`; `random`→`diagnostics`; `combat`→`diagnostics`; `test-support`→`deterministic`; `messages`→`test-support` (dev); `content-codemod`→`combat` (dev); `compiler-cli`→`content-schema`; `ship-visual`→`effect` (dev). Many `@types/*`, `typescript`, `vite`, `tailwindcss` entries in `apps/desktop` are also unreferenced by source (tooling, likely fine).
  - `tsconfig.json` references missing relative to declared deps: `campaign` (`ship-design`), `campaign-engine` (`events`, `contracts`), `commands` (`content-schema`), `phase-engine` (`armament`, `content-schema`), `ship-visual` (`content-schema`, `diagnostics`), `content-codemod` (`combat`), `desktop` (17 packages, it relies on `tsconfig.web.json`/`node.json`), and `compiler-cli` uses `../../packages/x` references that my regex flagged as extra only because of the path style.
  - Root `tsconfig.json` references omit `ai`, `combat`, `phase-engine` and `ship-visual`.
- **Current behavior:** it works because ordering is driven by `vp run -r build` using manifest deps, while `tsc -b` references are only partially used.
- **Why it matters:** phantom edges make the graph look more coupled than it is (`contracts` appears as a dependency of leaves that never import it), and missing references can produce stale `dist` or wrong incremental builds (the `quality.yml` comments already describe a stale `phase-engine` `dist` incident).
- **Root cause:** no gate compares the three sources of truth; `verify-package-dependencies.mjs` checks specifier shape only.
- **Remediation:** add a gate (extend `verify-package-dependencies.mjs`) that fails when a workspace dep is not imported, an imported workspace package is undeclared, or a declared workspace dep lacks a tsconfig reference. Fix existing drift, update the baseline-style allowlist for known exceptions, and complete the root references list.
- **Plan:** (1) write the checker with a self-test fixture; (2) run it, record the current set as a ratchet baseline; (3) fix package by package; (4) remove baseline entries.
- **Acceptance:** gate in preflight, drift list empty or explicitly allowlisted with reasons.
- **Validation:** `pnpm check:dependencies`, `pnpm test:scripts`, `pnpm typecheck`, `pnpm install --frozen-lockfile` (lockfile changes when deps are removed).
- **Risks:** removing a dependency changes `pnpm-lock.yaml`; do per package. Test-only and bundler-resolved imports need the checker to scan tests and configs.
- **Ordering:** independent.

### MONO-005: Release workflow does not re-run quality gates and packages Windows/Linux unsmoked
- **Priority** P2. **Category** Release. **Impact** medium. **Effort** medium. **Confidence** high on the workflow content; branch protection unknown. **Scope** repository-wide.
- **Evidence:** `release.yml` `verify` job only runs `scripts/verify-release-ref.mjs` (tag format, version match, commit on `main`). `mac`/`win`/`linux` jobs run `pnpm build` and package. The packaged-app smoke (`smoke:packaged`) exists only in `desktop-e2e.yml` on macOS, unpacked. No Windows or Linux packaged smoke exists. `pack` scripts also do not run `content:verify`.
- **Why it matters:** a tag on a `main` commit whose checks never ran (or were bypassed) still publishes a draft with signed artifacts; Windows and Linux packaging problems appear only when a user installs.
- **Remediation:** have `verify` require the commit's `Quality Gate`/`Desktop E2E` checks to be green (`gh api` on the commit status) or call `quality.yml` as a reusable workflow; add `smoke:packaged` on the Windows and Linux jobs (headless via `xvfb-run` on Linux).
- **Acceptance:** release fails when required checks are not green; each OS artifact passes a smoke before upload.
- **Validation:** `workflow_dispatch` dry run on a non-release ref (the ref check refuses, so test with a temporary allow flag in a branch).
- **Risks:** Linux needs a display server; signing steps untouched. Draft-only publishing already limits blast radius.
- **Ordering:** after MONO-003 (reuse the same checks).

### MONO-006: No secret scanning or static analysis in CI
- **Priority** P2. **Category** Security / supply chain. **Impact** medium. **Effort** small. **Confidence** high. **Scope** repository-wide. **QW:** yes.
- **Evidence:** searching `.github`, `scripts`, `vite.config.ts`, `package.json` for gitleaks, trufflehog, CodeQL, osv or similar finds nothing. The contract (Security section) requires "vulnerability scanning, license checks, and secret scanning". `pnpm audit` runs only in `quality.yml` (PRs into `main`) at `--audit-level=high`. `.github/dependabot.yml` covers npm and Actions only.
- **Remediation:** enable GitHub secret scanning and push protection (settings, no code) or add a pinned `gitleaks` step to `gates.yml`; add CodeQL for JavaScript/TypeScript on a weekly schedule. Run `pnpm audit` on a schedule too, not only at promotion.
- **Acceptance:** a seeded fake secret on a branch is flagged; scheduled audit job exists.
- **Validation:** workflow run on a throwaway branch.
- **Risks:** noise from fixtures and vendored code; configure path ignores for `vendor/**`.
- **Ordering:** independent. I did not scan history for committed secrets; a one-off scan is worth running with this change.

### MONO-007: Renderer sandbox disabled, IPC senders unchecked, Electron fuses unset
- **Priority** P2. **Category** Security / Electron boundary. **Impact** medium. **Effort** medium. **Confidence** high for facts, low for exploitability. **Scope** local.
- **Evidence:** `webPreferences.sandbox: false` (`apps/desktop/src/main/index.ts:105`); the preload is built as `index.mjs` (ESM), which Electron only supports with `sandbox: false`, a probable reason. `ipcMain.handle`/`on` handlers (lines 135-182) never inspect `event.senderFrame`/origin. `electron-builder.yml` configures no fuses (for example `RunAsNode`, `EnableNodeCliInspectArguments`, `OnlyLoadAppFromAsar`). The contract says "sandbox where compatible".
- **Why it matters:** with MONO-001 and MONO-002 closed, these are the remaining defence-in-depth gaps; today the preload surface is small and IPC payloads are decoded.
- **Remediation:** build the preload as CJS (electron-vite supports it) and enable `sandbox: true` if the preload only uses `contextBridge`/`ipcRenderer` (true today); validate `event.senderFrame.url` against the app origin in a shared wrapper; flip fuses with `@electron/fuses` in an `afterPack` hook; record the decision in an ADR.
- **Acceptance:** sandbox on, E2E and packaged smoke green, fuses verified by a post-pack script.
- **Validation:** `pnpm test:e2e`, `pnpm --filter @bluewave/desktop run smoke:packaged`.
- **Risks:** sandboxed preload cannot import Node modules; `process.platform` is still available. Needs an ADR (Electron boundary, replacement cost).
- **Ordering:** after MONO-001 and MONO-002.

### MONO-008: Third-party copyrighted reference material is committed
- **Priority** P2. **Category** Hygiene / legal. **Impact** medium. **Effort** small. **Confidence** confirmed presence; licence status unknown. **Scope** local.
- **Evidence:** `docs/Rule the Waves 3 Manual EBOOK.pdf` (about 13 MB) and `docs/research/Steam Community __ Guide __ Ship Design Guide (1890 to 1970).mhtml` (about 4.7 MB) are tracked; `docs/campaign-review.mhtml` also. These are the largest tracked files outside `vendor/`.
- **Why it matters:** redistributing a commercial manual and community guide in a repo that will ship a game is a licence risk and bloats every clone.
- **Remediation:** confirm rights; if not clearly held, remove from the tree (history rewrite is out of scope and forbidden by policy, so stop and raise a decision before purging history), keep extracted facts with citations in `docs/research`, and gitignore the originals.
- **Acceptance:** repository contains no unlicensed third-party documents, or a recorded licence note.
- **Validation:** `pnpm preflight` (docs link check), `git ls-files -z | xargs -0 du -k | sort -rn | head`.
- **Risks:** docs may link to these files; the history question needs the owner's decision.
- **Ordering:** independent.

### MONO-009: Node and pnpm versions are duplicated across eight places with no gate
- **Priority** P3. **Category** DX / reproducibility. **Impact** low. **Effort** small. **Confidence** confirmed. **Scope** repository-wide. **QW:** yes.
- **Evidence:** Node `24.18.0` appears in `.node-version` and in `setup-node` in all six workflows; pnpm `11.21.0` in `package.json#packageManager` and in `pnpm/action-setup` in five workflows. No script under `scripts/` checks them (searching for both strings in `scripts/*.mjs|cjs` finds nothing).
- **Remediation:** use `node-version-file: .node-version` and drop the explicit `version:` for `pnpm/action-setup` (it reads `packageManager`). Dependabot then bumps one place.
- **Acceptance:** one declared version per tool; workflows still green.
- **Validation:** `workflow_dispatch` on `gates.yml`.
- **Risks:** none material; action SHAs stay pinned.

- **Implementation status (2026-10-27): implemented.** Every `setup-node` step now uses `node-version-file: ".node-version"` and every `pnpm/action-setup` step omits `version` (it reads `packageManager`; the pinned action's README states pnpm 11+ may omit it). Correction to the evidence: the literals appeared 10 times for Node and 7 for pnpm across the workflows (the release workflow repeats them per job). Not yet observed on a hosted runner; confirm on the first CI run of this branch.

### MONO-010: Stale `turbo` references after the move to Vite+
- **Priority** P3. **Category** Hygiene. **Impact** low. **Effort** small. **Confidence** confirmed. **Scope** local. **QW:** yes.
- **Evidence:** `.github/workflows/determinism.yml:62` ("turbo cache-replay"), `docs/agents/change-scope.md:6` (`turbo run … --filter`), a comment in `scripts/vendor-effect-sync.mjs:110`, and `.turbo` skip entries in `scripts/sweep-comments*.mjs`. The latest commit history includes "drop stale turbo references", so this is a leftover.
- **Remediation:** reword to the `vp` task cache; keep the `.turbo` skip if harmless, or delete it.
- **Acceptance:** `grep -ri turbo` finds nothing meaningful. **Validation:** `pnpm preflight` (docs gates), `pnpm test:scripts`.

- **Implementation status (2026-10-27): implemented.** Reworded `determinism.yml`, `docs/agents/change-scope.md` and `scripts/vendor-effect-sync.mjs`; removed the dead `.turbo` skip entries from both comment-sweep scripts and from three `.opencode` prompts. Left deliberately: the `turbo run build` example in `scripts/test/verify-check-parity.test.mjs` (a fixture for an unparseable step), `.ai/BOOTSTRAP-PROMPT.md` (historical prompt), and the vendored third-party `.agents/skills`. The repository has no `turbo.json`; the task runner is Vite+ (`vp run`).

### MONO-011: Package `exports` point types at source and runtime at `dist`
- **Priority** P3. **Category** Types / build. **Impact** medium. **Effort** medium. **Confidence** low to medium (hypothesis). **Scope** multi-package.
- **Evidence:** for example `packages/campaign/package.json`: `"types": "./src/index.ts"`, `"default": "./dist/index.js"`. Root `test` and `typecheck` scripts both run `vp run -r build` first.
- **Why it matters:** consumers type-check against another package's source while executing its built output, so editor, `tsc -b`, tests and runtime can see different code if `dist` is stale; declaration output (`declaration: true`) is generated but unused. Measure before changing: time a typecheck with declarations versus source, and check whether any stale-`dist` failures recur (the CI comments suggest one did).
- **Remediation if confirmed:** point `types` at `dist/*.d.ts` and rely on project references, or keep source types and document the invariant with a gate that fails when `dist` is older than `src`.
- **Dependencies:** MONO-004 (reference correctness) first.

### MONO-012: `pnpm check` builds repeatedly and runs fully serial
- **Priority** P3. **Category** Performance / DX. **Impact** low to medium. **Effort** medium. **Confidence** medium (needs profiling). **Scope** repository-wide.
- **Evidence:** `check:steps` runs `typecheck` (which itself runs `vp run -r build`), then `pnpm build`, `content:verify` (rebuilds compiler-cli), then tests, in one `&&` chain; `scripts/heavy.mjs` additionally serializes sessions. During this audit my preflight queued behind another session's full check.
- **Why it matters:** the Vite Task cache probably absorbs most repeats, but `quality.yml` already uses `--no-cache` for one build because cache replay served a stale `dist`, which indicates cache inputs are not fully declared.
- **Remediation:** profile with `vp run --last-details`; if builds repeat, express the chain as a task graph with dependencies rather than a shell `&&` chain; audit task input declarations (a correctness issue if the cache can replay stale output).
- **Validation:** measure wall time before and after on a clean tree.

### MONO-013: Foundational determinism packages have thin direct test suites
- **Priority** P3. **Category** Testing. **Impact** medium. **Effort** medium. **Confidence** low (coverage not measured). **Scope** multi-package.
- **Evidence:** test file counts: `random` 1, `diagnostics` 1, `contracts` 2, `deterministic` 2, `events` 6, versus `combat` 301 and `desktop` 422. No coverage configuration exists in `vite.config.ts` or the vitest configs.
- **Why it matters:** these packages underpin every golden hash; indirect coverage through golden hashes and the replay corpus is strong but diagnoses poorly.
- **Remediation:** measure branch coverage for just those packages (one-off `vp test run --coverage`) and add property tests for RNG stream derivation and canonical serialization where gaps appear. Do not add a global coverage threshold.

## 5. Quick-win plan

| # | Scope | Why safe | Benefit | Files | Acceptance | Validation | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QW1 (MONO-009) | Use `node-version-file` and `packageManager` in workflows | CI config only, no product code | one source of truth for tool versions | `.github/workflows/*.yml` | all workflows green | `workflow_dispatch` on `gates.yml` | under 1 h |
| QW2 (MONO-010) | Reword stale turbo mentions | comments and docs | accurate docs | `determinism.yml`, `docs/agents/change-scope.md`, `scripts/vendor-effect-sync.mjs` | no stale mentions | `pnpm preflight`, `pnpm test:scripts` | under 1 h |
| QW3 (MONO-006) | Enable GitHub secret scanning and push protection; add scheduled `pnpm audit` | settings plus one workflow | closes a contract gap | repo settings, new workflow | seeded fake secret flagged | throwaway branch | 1-2 h |
| QW4 (MONO-001) | Window-open, navigation and permission deny handlers with unit tests | small, deny-by-default, testable pure predicates | removes the main Electron gap | `shellPolicy.ts`, `shellPolicy.test.ts`, `index.ts` | tests pass; E2E shows no navigation | `pnpm --filter @bluewave/desktop exec vp test run src/main/shellPolicy.test.ts`, `pnpm test:e2e`, `pnpm snap` | 2-4 h |

MONO-002 becomes a quick win once its runtime check (does the header reach `file://`?) is done.

## 6. Prioritized roadmap

**Immediate safeguards:** MONO-001, MONO-002, QW3.
**Near-term:** MONO-003 (decide cost, then add the push trigger), MONO-004 (checker first, then drift cleanup), MONO-008 (rights decision), QW1 and QW2.
**Medium-term architecture:** MONO-007 (needs an ADR; do after MONO-001/002), MONO-005 (after MONO-003 so release can reuse the checks).
**Deferred or measurement-dependent:** MONO-011, MONO-012, MONO-013. Each starts with a measurement; do not change code before it.

Sequencing: MONO-004 precedes MONO-011; MONO-001 and MONO-002 precede MONO-007; MONO-003 precedes MONO-005.

## 7. Practices already done well

- Self-tested gates and the preflight DAG (`vite.config.ts`), CI/`pnpm check` parity gate (`scripts/verify-check-parity.mjs`).
- Ratchet baselines (`*.baseline.json`, `golden-repin.baseline`) instead of blanket exceptions.
- Golden hashes plus replay corpus with hash-bound approvals; cross-OS nightly determinism.
- Dependency policy gate (no floating specifiers, exact toolchain, `workspace:` for internal deps, single-copy `effect`).
- Workflows: SHA-pinned actions, `persist-credentials: false`, minimal `permissions`, environment-scoped signing secrets, early check for missing signing credentials, ref verification before release.
- Version coherence between app version and save compatibility (`verify-version-coherence.mjs`).
- Per-package `AGENTS.md` with a gate (`verify-package-agents.mjs`), doc word budgets, ADR index and scope checks.
- Branch discipline hook refusing direct commits to `dev`/`main`.
- Renderer-bundle check in the desktop build (`check-renderer-bundle.mjs`) and a packaged-app smoke test.

## 8. Unknowns and limitations

- Heavy baseline not run (typecheck, build, full tests, golden, determinism, balance reports, E2E, packaged smoke); cause in section 3.
- MONO-002 requires a runtime check of whether `onHeadersReceived` applies to `file://` loads in the pinned Electron version.
- GitHub settings (branch protection, required checks, secret scanning, Dependabot behaviour for the pnpm `catalog:` entries) are not visible from the repository.
- No Windows or Linux runtime was available; cross-OS claims rest on the workflow definitions.
- Not examined in depth: `content/` authoring data, renderer component quality and accessibility beyond noting a11y tests exist, `ai` package logic, persistence migration correctness, the `vendor/` contents beyond the audit result.
- Type-escape counts (about 33 in `apps/desktop`, 14 in `phase-engine`, in non-test source) were counted but not triaged, so no finding was raised.
- Whether the committed `docs` binaries are licensed (MONO-008) needs the owner.
- Ticket drafts were not generated; `docs/agents/issue-tracker.md` defines GitHub Issues, and creating remote issues was not authorized.

Counts: P0 0, P1 2, P2 6, P3 5 (13 findings).
