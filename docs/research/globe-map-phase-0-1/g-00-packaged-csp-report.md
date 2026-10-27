# G-00: packaged production CSP gate

**Decision: PASSED (passed-with-limitations).** MapLibre GL JS 6.16.0 runs in a packaged macOS arm64 build under the unchanged production CSP and unchanged Electron security settings. No `src/main` file was modified.

Labels: **[F]** repo fact, **[M]** measured, **[U]** unverified.

## 1. Where the CSP comes from **[F]**

- `apps/desktop/src/main/csp.ts`. Production policy:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
  There is **no** `worker-src`, `blob:`, or `unsafe-eval`.
- Delivered as a response header by `session.defaultSession.webRequest.onHeadersReceived` in `createWindow` (`src/main/index.ts`), not by a `<meta>` tag.
- Development uses a different policy (`DEV_CONTENT_SECURITY_POLICY`: localhost:5173, `unsafe-eval`, `unsafe-inline`). Only the production policy was used for this gate.
- Packaged builds load the renderer with `win.loadFile(RENDERER_ENTRY)`, i.e. `file://`. There is no custom app protocol.
- `webPreferences`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; navigation and window-open handlers in `shellGuards.ts`; IPC guard in `guardIpc`.

## 2. What MapLibre needed

| Question | Answer |
|---|---|
| `worker-src` / `blob:` / `unsafe-eval` / inline script? | **None needed [M].** All 29 packaged checks pass with the CSP unchanged. `eval` is still blocked by a page-resident probe. |
| How is the worker created? | `new Worker(url, { type: "module" })` inside MapLibre; `url` is a Vite `?url` asset (`assets/maplibre-gl-worker-<hash>.mjs`) passed through `setWorkerUrl(new URL(workerUrl, document.baseURI).href)`. It runs from the packaged renderer directory over `file://` and matches `script-src 'self'`. |
| Do Vite/electron-builder rewrite the worker URL? | Vite hashes the file name; the `?url` import returns the hashed relative URL, resolved against `document.baseURI`. electron-builder packs it unchanged into `app.asar`. |
| Are worker/map assets in the artifact? | Yes **[M]**: `app.asar` lists `/out/renderer/assets/maplibre-gl-worker-CMkqA50c.mjs`, `GlobeSpike-*.js`, `GlobeSpike-BUWBlw7H.css`, and `/out/renderer/map-spike/glyphs/Inter Regular/{0-255,256-511,8192-8447}.pbf`. |
| Do all map resources resolve locally? | Style, sources (in-memory GeoJSON), glyphs (packaged PBFs), worker: yes. No sprite is used. `fetch(file://)` is permitted by Electron; every request in the log is `file:` or `devtools:`. |
| Was a library bypass or unsafe API introduced? | No. |

## 3. Implementation (all behind a build-time flag)

- `maplibre-gl@6.16.0` exact pin in `apps/desktop/package.json` (+154 lines in `pnpm-lock.yaml`).
- Build flag: `VITE_BLUEWAVE_GLOBE_SPIKE=true` (`pnpm --filter @bluewave/desktop run build:globe-spike`) defines `__GLOBE_SPIKE__` in `electron.vite.config.ts`. The flag-gated overlay is lazy-loaded only when the flag is true and the URL hash is `#globe-spike`.
- **Default build contains no MapLibre chunk or worker [M]**: a clean default build has 14 renderer chunks (15 with the flag), no `maplibre*` file; the only trace is the small `GlobeSpikeHost` wrapper in `main.tsx`.
- Failure fallback: any initialisation failure (or the forced-failure hash `#globe-spike-fail`) clears the hash and the current renderer remains in place.
- Tests/gates: lint, typecheck and the full `pnpm preflight` (53/53 gates) passed on each commit.

## 4. Packaged validation **[M]**

Commands:

```
pnpm --filter @bluewave/desktop run build:globe-spike
cd apps/desktop && CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --dir --config electron-builder.yml
env -u ELECTRON_RUN_AS_NODE node scripts/globe-spike-smoke.mjs                      # normal run
env -u ELECTRON_RUN_AS_NODE node scripts/globe-spike-smoke.mjs --app <wrapper> --cycles 3   # OS network denied
```

(`ELECTRON_RUN_AS_NODE=1` is set in this user's shell; unset it for Electron.)

| Requirement | Result |
|---|---|
| Packaged app starts (`app.isPackaged`) | pass |
| Existing app works with the flag off | pass: spike inactive by default; `pnpm smoke:packaged` on the **default** packaged build passes all 21 existing checks (including "packaged CSP blocks inline scripts", "locks base-uri", "denies renderer-created windows", "keeps a single window") |
| Experimental map enabled without changing gameplay state | pass: overlay only; no IPC, no command dispatched |
| Worker starts under the shipped CSP | pass: `workers 0 -> 1` via CDP `Target.getTargets` |
| No CSP violations during startup, render, interaction, transition, markers, shutdown | pass (a deliberate remote-fetch probe is the only violation, and it is excluded by design) |
| No remote requests | pass: request log has only `file:`/`devtools:`/`data:`/`blob:` |
| Required assets in artifact | pass (see §2) |
| Security configuration intact | pass: `contextIsolation true`, `nodeIntegration false`, `sandbox true`, `webSecurity` not disabled; renderer has no `require`/`process`; `eval` blocked; remote `fetch` blocked; served from `file:` |
| Teardown releases workers, listeners, resources | pass: 10 open/close cycles; after forced GC, listeners 472 -> 491 (flat across all 10 cycles), DOM nodes 127 -> 142 (flat), heap 38.9 -> 39.7 MB, workers 0 after each close, WebGL context lost after remove |
| Reopening does not accumulate | pass (same data) |
| Fails safely to the current renderer | pass: forced failure reported, hash cleared, current app still usable |
| Packaged smoke passes | pass (29/29 for the spike build; 21/21 default) |

### Offline, stronger than request logging **[M]**

`sandbox-exec` with a profile that denies all network except loopback and Unix sockets (`phase01/offline/deny-net.sb`). Controls: under the profile, an external TCP connect and curl fail while a loopback connect succeeds; the same connect succeeds outside the profile. The packaged spike passes **29/29** under the profile.

Limitation: Chromium's own seatbelt sandbox cannot nest inside `sandbox-exec`, so that run adds `--no-sandbox` to the launch; the `sandbox` check in that run reports the requested `webPreferences`, not the OS process sandbox. The ordinary run (sandbox on, application-level interceptor, 0 non-local requests) is the evidence for the security configuration; the OS run is evidence that no network access was possible. macOS system log did not show denials (`log show` predicate returned nothing; **[U]** whether that means no attempts or a wrong predicate).

## 5. Before/after security posture

| Item | Before | After |
|---|---|---|
| `src/main/**` | unchanged | unchanged (git diff shows no change) |
| Production CSP | as above | identical |
| webPreferences | contextIsolation, no nodeIntegration, sandbox | identical |
| New renderer capability | none | an in-renderer WebGL canvas and a module worker from the app directory, only in flagged builds |
| New dependency | none | maplibre-gl 6.16.0 (BSD-3-Clause) |

## 6. Findings and limitations

1. **Packaging footprint:** `node_modules/maplibre-gl` (29 MB incl. source maps and dev builds, 789 files) is shipped inside `app.asar` **in addition to** the bundled chunk, because the dependency is declared under `dependencies` like `react` (the repo already ships bundled renderer deps this way). Spike app.asar: 218,275,539 bytes. Moving it to `devDependencies` should remove the copy; **[U]** until tested (ticket N-04).
2. **Single platform [U]:** only macOS 27.0.1 arm64 was packaged and run. The `file://` module-worker path is Chromium behaviour and should be the same on Windows/Linux, but it was not run there (ticket N-05, blocked-external).
3. **Engine warning:** "Max vertices per segment is 65535: bucket requested 117990" for large land polygons; rendering looked correct but fill integrity at all zooms is not proven.
4. Nothing in G-00 triggers a no-go condition: no CSP weakening, no unsafe-eval, no Node integration, no remote worker, no wildcard, no filesystem capability, no leak.

Evidence: `phase01/evidence/g00-final/` (smoke.log, smoke-os-netdeny.log, asar-list.txt, pack.log), `phase01/evidence/validate*/`.
