import { ChevronDown, ChevronUp } from "lucide-react";

import { Toggle } from "../../components/ui/toggle.js";
import { DeferredPopover } from "./DeferredPopover.js";
import { useStatusStripActions, useStatusStripState } from "./StatusStripContext.js";

export function StatusStripControls() {
  const { expanded } = useStatusStripState();
  const { setExpanded } = useStatusStripActions();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <DeferredPopover />
      <Toggle
        variant="outline"
        size="sm"
        pressed={expanded}
        onPressedChange={setExpanded}
        className="h-5 min-w-0 gap-1 px-1.5 text-xs"
      >
        {expanded ? (
          <ChevronDown className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronUp className="size-3.5" aria-hidden="true" />
        )}
        <span>{expanded ? "Collapse" : "Expand"}</span>
      </Toggle>
    </div>
  );
}
