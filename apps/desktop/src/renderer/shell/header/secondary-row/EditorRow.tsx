import { AlertTriangle, Database, Save } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import { Separator } from "../../../components/ui/separator.js";
import type { EditorRowModel } from "../../site-header-state.js";
import { NO_DRAG } from "../drag-region.js";

export interface EditorRowProps {
  readonly row: EditorRowModel;
  readonly onActionClick?: ((actionCode: string) => void) | undefined;
}

/** The scenario-editor bar: the active scenario on the left, its commands on the right. */
export function EditorRow({ row, onActionClick }: EditorRowProps) {
  return (
    <div className="flex w-full items-center justify-between px-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5" />
        <span className="tracking-wider uppercase">{row.scenario}</span>
      </div>
      <div className="flex items-center gap-1.5" style={NO_DRAG}>
        {row.actions.map((action, index) => (
          <div key={action.code} className="flex items-center gap-1.5">
            {index > 0 && <Separator orientation="vertical" className="h-3" />}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[12px] font-medium tracking-wider uppercase"
              onClick={() => onActionClick?.(action.code)}
            >
              {action.icon === "validate" ? (
                <AlertTriangle className="mr-1 h-3 w-3" />
              ) : (
                <Save className="mr-1 h-3 w-3" />
              )}
              {action.label}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
