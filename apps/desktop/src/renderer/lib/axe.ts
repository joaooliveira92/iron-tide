import axe, { type AxeResults, type Result } from "axe-core";

// axe-core has a single module-level "is running" flag: two overlapping `axe.run` calls make the
// second throw "Axe is already running". Serialize every run through one queue so that can never
// happen (two audits in the same worker, or a pass abandoned by a test timeout).
let pending: Promise<unknown> = Promise.resolve();

/**
 * Runs axe-core on a rendered container and returns the violations, formatted so a failing
 * assertion says what is wrong and where. `color-contrast` is off: jsdom has no layout or
 * styles engine, so axe cannot compute it reliably here (contrast is checked in the real app).
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const run = pending.then(() =>
    axe.run(container, { rules: { "color-contrast": { enabled: false } } }),
  );
  // Keep the queue alive even if a run rejects, so one failure cannot wedge every later audit.
  pending = run.catch(() => undefined);
  const results: AxeResults = await run;
  return results.violations.map(
    (violation: Result) =>
      `${violation.id} (${violation.impact ?? "n/a"}): ${violation.help} — ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join("; ")}`,
  );
}
