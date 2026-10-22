import axe, { type AxeResults, type Result } from "axe-core";

let pending: Promise<unknown> = Promise.resolve();

export async function axeViolations(container: Element): Promise<string[]> {
  const run = pending.then(() =>
    axe.run(container, { rules: { "color-contrast": { enabled: false } } }),
  );
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
