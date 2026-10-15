import { Play } from "lucide-react";

import type { WizardRowModel } from "../../site-header-state.js";

export interface WizardRowProps {
  readonly row: WizardRowModel;
}

/** The new-game bar: the setup assistant heading and its current instruction. */
export function WizardRow({ row }: WizardRowProps) {
  return (
    <div className="flex w-full items-center justify-between px-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Play className="h-3.5 w-3.5" />
        <span className="tracking-wider uppercase">{row.heading}</span>
      </div>
      <div className="text-[12px] uppercase">{row.hint}</div>
    </div>
  );
}
