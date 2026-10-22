import { useEffect, useRef, useState } from "react";
import { ArrowRight, ListChecks } from "lucide-react";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { analysisDestination, fixDestination, type Destination } from "../selection/navigation.js";
import type { BoardFinding } from "./boardFindings.js";
import { valueLine } from "./format.js";
import { SEVERITY_STYLE } from "./severity.js";

export const RESOLVED_NOTE_MS = 5000;

export function FindingList({
  entityKey,
  findings,
  focused,
  onGoTo,
}: {
  readonly entityKey: string;
  readonly findings: readonly BoardFinding[];
  readonly focused: string | null;
  readonly onGoTo: (d: Destination) => void;
}) {
  const format = usePresentationFormat();
  const previous = useRef<{ entityKey: string; findings: readonly BoardFinding[] }>({
    entityKey,
    findings,
  });
  const [resolved, setResolved] = useState<readonly string[]>([]);
  const keys = findings.map((f) => f.key).join("\n");
  useEffect(() => {
    const before = previous.current;
    previous.current = { entityKey, findings };
    if (before.entityKey !== entityKey) {
      setResolved([]);
      return;
    }
    const gone = before.findings
      .filter((f) => !findings.some((g) => g.key === f.key))
      .map((f) => f.title);
    if (gone.length === 0) return;
    setResolved(gone);
    const t = window.setTimeout(() => setResolved([]), RESOLVED_NOTE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, keys]);

  return (
    <div className="space-y-1.5">
      <p
        role="status"
        aria-live="polite"
        className="text-xs text-success empty:hidden"
        data-testid="resolved-note"
      >
        {resolved.length > 0 && `Resolved: ${resolved.join("; ")}`}
      </p>
      {findings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No findings for this selection.</p>
      ) : (
        <ul className="space-y-2" aria-label="Findings for this selection">
          {findings.map((f) => {
            const style = SEVERITY_STYLE[f.severity];
            const fix = fixDestination(f);
            const values = valueLine(f, format);
            const isFocused = f.key === focused;
            return (
              <li
                key={f.key}
                data-inspector-finding={f.key}
                aria-current={isFocused || undefined}
                className={cn(
                  "space-y-1 rounded-md border p-2 text-xs",
                  isFocused && "border-primary ring-1 ring-primary",
                )}
              >
                <div className="flex items-start gap-1.5">
                  <style.Icon
                    aria-hidden="true"
                    className={cn("mt-0.5 size-3.5 shrink-0", style.tone)}
                  />
                  <Badge variant={style.badge}>{f.severity}</Badge>
                  <span className="font-medium">{f.title}</span>
                </div>
                <p className="text-muted-foreground">{f.explanation}</p>
                {values && <p className="tabular-nums">{values}</p>}
                {f.association === "inferred" && (
                  <p className="text-muted-foreground italic">
                    Linked by reading the finding's wording, not by the rule: the match may be
                    imprecise.
                  </p>
                )}
                <details className="text-muted-foreground">
                  <summary className="cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-ring">
                    Rule details
                  </summary>
                  <p>
                    Rule <span className="font-mono">{f.rule}</span> ·{" "}
                    {f.association === "structured"
                      ? "linked by the rule"
                      : "inferred from wording"}
                  </p>
                </details>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {fix ? (
                    <Button size="sm" variant="outline" onClick={() => onGoTo(fix)}>
                      Go to fix
                      <ArrowRight aria-hidden="true" className="ml-1 size-3.5" />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">
                      No single setting fixes this; the Analysis tab lists ways to fix it.
                    </span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onGoTo(analysisDestination(f))}>
                    <ListChecks aria-hidden="true" className="mr-1 size-3.5" />
                    Open in Analysis
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
