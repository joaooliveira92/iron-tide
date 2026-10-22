import { ClockArrowRight } from "lucide-react";

import { Button } from "../../components/ui/button.js";
import type { PrimaryAction } from "../primary-action.js";

export interface HeaderContinueActionProps {
  readonly action: PrimaryAction;
}

export function HeaderContinueAction({ action }: HeaderContinueActionProps) {
  return (
    <Button
      variant="outline"
      aria-label={action.label}
      onClick={action.onTrigger}
      disabled={action.disabled}
      className="min-w-44 max-w-80 shrink-0 justify-center gap-2"
    >
      <ClockArrowRight className="h-4 w-4" />
      <span className="truncate">{action.label}</span>
    </Button>
  );
}
