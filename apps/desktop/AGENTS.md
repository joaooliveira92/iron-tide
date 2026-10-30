# @bluewave/desktop

**Role:** Electron desktop app: main process, preload bridge and React renderer.

**Boundary:** The renderer and preload import no `effect`; the full Effect runtime lives only in `src/main`. Boundary payloads (IPC, saves) are decoded with a strict schema before use.

**Invariants:**

- A UI change is verified in the running app with `pnpm snap` before it is done.
- Every number the player sees traces to an explanation tree.
- Channels are declared once in `shared/ipc-contract.ts`; navigation, permission and CSP share one policy.
- `electron-builder.json` ships content as `extraResources` from `content/generated/1880` (resolved via `process.resourcesPath`), never by a repo-root walk.

Root rules in [AGENTS.md](../../AGENTS.md) apply. Guides: [desktop view](../../docs/agents/desktop-view.md), [desktop snap](../../docs/agents/desktop-snap.md).
