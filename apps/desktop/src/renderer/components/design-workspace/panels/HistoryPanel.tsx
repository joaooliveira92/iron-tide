import { Button } from "../../ui/button.js";
import { cn } from "../../../lib/utils.js";
import type { DrawingBoardContent } from "../content.js";
import { describeEdit } from "../describeEdit.js";
import type { DraftEdit } from "@bluewave/ship-design";
import { Panel } from "./Panel.js";

/** The edit history as a list; choosing a step moves the working design there (later steps stay redo-able). */
export function HistoryPanel({
  history,
  cursor,
  startName,
  content,
  jumpTo,
}: {
  readonly history: readonly DraftEdit[];
  readonly cursor: number;
  readonly startName: string;
  readonly content: DrawingBoardContent;
  readonly jumpTo: (cursor: number) => void;
}) {
  const names = new Map(content.catalogue.map((e) => [e.id, e.displayName]));
  const nameOf = (id: string) => names.get(id) ?? id;
  const steps = [`Start: ${startName}`, ...history.map((e) => describeEdit(e, nameOf))];
  return (
    <Panel title="Edit history">
      <ol className="max-h-64 space-y-1 overflow-y-auto text-sm">
        {steps.map((label, i) => (
          <li key={i} className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto justify-start whitespace-normal py-1 text-left",
                i > cursor && "text-muted-foreground line-through",
                i === cursor && "font-semibold",
              )}
              aria-current={i === cursor ? "step" : undefined}
              onClick={() => jumpTo(i)}
            >
              {i}. {label}
            </Button>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
