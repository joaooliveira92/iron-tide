# Lifecycle findings (N-09)

Both paths were measured in the same packaged builds as the hitch runs, on the same Apple M4 /
macOS 27.0.1 machine. The adapter portion of N-09 is flat; the legacy spike retains +27 listeners
and +97 DOM nodes after the first close, which is unchanged from the earlier G-03/G-07 finding.

## 1. Method

- Packaged app, fresh `--user-data-dir` per run.
- CDP `HeapProfiler.collectGarbage` twice, then `Memory.getDOMCounters`,
  `Runtime.getHeapUsage`, and `Target.getTargets` for the worker count.
- Baseline is taken before any globe renderer is opened.
- The adapter is opened and closed by setting `window.location.hash` to `#globe-adapter-demo` and
  back to empty; the spike uses its own hash. Five open-close cycles.
- "First" is after the first close; "last" is after the fifth close. The live DOM is checked
  separately from the retained node count.
- No test was changed and no sleep was added as a synchronisation primitive. The existing
  packaged smokes were re-run unchanged.

Evidence: `evidence/adapter/globe-adapter-smoke.json` (41/41 checks) and
`evidence/spike/result.json`.

## 2. Adapter path

| Point | Listeners | DOM nodes | Documents | Workers | Heap |
|---|---|---|---|---|---|
| Baseline | 471 | 139 | 1 | 0 | 9.4 MB |
| Open | 537 | 272 | 1 | 1 | 16.5 MB |
| After first close | 497 | 272 | 1 | 0 | 15.5 MB |
| After fifth close | 497 | 272 | 1 | 0 | ~15 MB |

- **No growth across cycles:** 497 listeners and 272 nodes after the first close and after the
  fifth; heap 14.7 -> 15.0 MB in the smoke check.
- **Workers return to 0**; the map worker does not survive close.
- **CDP attribution:** the absolute +26 listeners over baseline are 13 Playwright window
  listeners plus one MapLibre document `visibilitychange` listener plus harness bookkeeping; the
  smoke's own attribution check passes at `baseline 471, last 497`.
- **Retained nodes:** the extra nodes are detached; the live element count after close is the
  baseline plus two harness nodes. They are bounded library/harness state, not a live map.
- **Verdict:** adapter portion of N-09 remains **resolved for G-07**.

## 3. Legacy spike path

| Point | Listeners | DOM nodes | Documents | Workers | Heap |
|---|---|---|---|---|---|
| Baseline | 473 | 135 | 1 | 0 | 9.4 MB |
| After first close | 500 | 232 | 1 | 0 | 15.7 MB |
| After fifth close | 500 | 232 | 1 | 0 | 16.5 MB |

- **+27 listeners and +97 nodes** relative to baseline, constant after the first close.
- **Workers return to 0**; heap rises 15.7 -> 16.5 MB across the cycles.
- The two strict N-09 checks still **fail** exactly as recorded in the G-03/G-07 reports. They
  are reported, not reclassified or hidden.
- **Verdict:** legacy spike finding **unchanged**. The spike remains throwaway investigation
  code; no fix is authorized or attempted here.

## 4. Interpretation and limits

The adapter's retained footprint is bounded and detached, with a specific attribution. The spike
retains more, but it is not the production candidate and is not shipped in the default build.
The absolute numbers are CDP counters, not a claim that every retained node is reachable from
the document. The measurement is single-run per path, on one OS and GPU; it is not cross-OS
evidence. No leak was observed that would justify a code fix under the audit's narrow-fix rule.
