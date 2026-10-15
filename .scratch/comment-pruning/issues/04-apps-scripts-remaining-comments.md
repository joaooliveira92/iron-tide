# 04: Remove remaining low-value comments — apps and scripts

**Type:** implementation

**What to build:** Strip the remaining useless comments from the desktop app and
the scripts: labels that merely repeat the following command/handler name,
decorative JSX banner wrappers (keep any meaningful label text, drop the
decoration), and the one commented-out JSX element. Preserve rationale-bearing
comments, including the external-bug workarounds (devtools installer, WebKit
`backdrop-filter`, Playwright fixture shape) and the renderer runtime-free notes.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler/command name-restating labels and generic group labels are removed.
- [x] Decorative JSX banner wrappers are removed; meaningful label text is retained.
- [x] The commented-out JSX element is deleted.
- [x] Rationale-bearing and external-bug-workaround comments are preserved.
- [x] Lint, format, and the desktop/compiler-cli test suites pass.

## Comments

Removed handler-name labels (`// inspectConstructionScreen`,
`// loadCampaign`, …) in `apps/desktop/src/main/commands/*`; dropped the decorative
`── … ──` JSX banner decoration while keeping the label text in
`NationSelectionScreen.tsx`, and deleted the commented-out `{/*<StatusBar />*/}`
element. Rationale / external-bug-workaround comments preserved.

Validated: `vp fmt --check .` all files correct; `vp lint .` 0 errors;
`vp run -r --concurrency-limit 4 test` 2053 passed | 1 skipped.
