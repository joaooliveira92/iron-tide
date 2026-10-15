import { Play } from "lucide-react";

import { Button } from "../../components/ui/button.js";

export interface HeaderAdvanceMonthProps {
  readonly onAdvance: () => void;
  readonly advancing: boolean;
}

/** The single Turn control: resolves the current strategic month. */
export function HeaderAdvanceMonth({ onAdvance, advancing }: HeaderAdvanceMonthProps) {
  return (
    <Button
      variant="outline"
      aria-label="Advance month"
      data-guided-target="advance-month"
      title="Resolve the current strategic month"
      onClick={onAdvance}
      disabled={advancing}
      className="h-8 shrink-0 justify-center gap-2 px-3"
    >
      <Play className="h-4 w-4" />
      <span className="truncate">{advancing ? "Advancing…" : "Advance Month"}</span>
    </Button>
  );
}
