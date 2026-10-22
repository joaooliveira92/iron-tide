import { useState } from "react";
import type { Candidate, DesignDraft } from "@bluewave/ship-design";
import { Button } from "../../ui/button.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { ConfirmAction } from "../ConfirmAction.js";
import { Panel } from "./Panel.js";
import { plural } from "../plural.js";

const archetypeLabel: Record<string, string> = {
  CONSERVATIVE: "Conservative and reliable",
  BALANCED: "Balanced",
  AGGRESSIVE: "Aggressive, high risk",
  LOW_COST: "Low-cost, for numbers",
  LONG_RANGE: "Long range",
  UPGRADE: "Upgrade-oriented",
};

export function AlternativesPanel({
  generate,
  onLoad,
  dirty,
}: {
  readonly generate: () => Candidate[];
  readonly onLoad: (d: DesignDraft) => void;
  readonly dirty: boolean;
}) {
  const format = usePresentationFormat();
  const [state, setState] = useState<{
    readonly status: "idle" | "working" | "done";
    readonly list: Candidate[];
  }>({ status: "idle", list: [] });
  const run = () => {
    setState({ status: "working", list: [] });
    setTimeout(() => setState({ status: "done", list: generate() }), 20);
  };
  return (
    <Panel title="AI alternatives">
      <p className="text-xs text-muted-foreground">
        The AI designer uses the same rules, costs and validation as you do. It starts from the
        current design.
      </p>
      <Button variant="outline" onClick={run} disabled={state.status === "working"}>
        {state.status === "working" ? "Designing…" : "Generate alternatives"}
      </Button>
      {state.status === "done" &&
        (state.list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No valid alternative found from this starting point.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="AI candidates">
            {state.list.map((c) => {
              const k = c.compiled;
              return (
                <li
                  key={c.compiled.hash}
                  className="flex items-start justify-between gap-3 rounded border p-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{archetypeLabel[c.archetype] ?? c.archetype}</div>
                    <div className="text-xs text-muted-foreground">
                      {format.measurement(k.totalKg, "mass", { maximumFractionDigits: 0 })} ·{" "}
                      {format.number((k.machinery?.maxSpeedMilliKnots ?? 0) / 1000, {
                        maximumFractionDigits: 1,
                      })}{" "}
                      kn · {format.number(k.machinery?.rangeNmAtCruise ?? 0)} nm · cost{" "}
                      {format.moneyFromMicro(c.costMicro)} ·{" "}
                      {plural(
                        k.findings.filter((f) => f.severity !== "ADVISORY").length,
                        "finding",
                        undefined,
                        undefined,
                        format,
                      )}{" "}
                      · CVE {format.number(c.cveBp / 100, { maximumFractionDigits: 0 })}/100
                      (development metric)
                    </div>
                  </div>
                  <ConfirmAction
                    size="sm"
                    confirm={dirty}
                    title="Replace your design?"
                    description="Loading this candidate replaces the design you are working on, and its edit history is cleared."
                    confirmLabel="Replace my design"
                    onConfirm={() => onLoad(c.draft)}
                  >
                    Load design
                  </ConfirmAction>
                </li>
              );
            })}
          </ul>
        ))}
    </Panel>
  );
}
