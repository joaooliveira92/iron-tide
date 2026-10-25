import { Play } from "lucide-react";

import { Button } from "../../components/ui/button.js";
import { translate } from "../../lib/strings.js";
import { Tip } from "../../components/ui/tip.js";

export interface HeaderAdvanceMonthProps {
  readonly onAdvance: () => void;
  readonly advancing: boolean;
  readonly disabled?: boolean;
}

export function HeaderAdvanceMonth({
  onAdvance,
  advancing,
  disabled = false,
}: HeaderAdvanceMonthProps) {
  return (
    <Tip label={translate("shell.header.advanceMonth.title")}>
      <Button
        variant="outline"
        aria-label={translate("shell.header.advanceMonth.aria")}
        data-guided-target="advance-month"

        onClick={onAdvance}
        disabled={advancing || disabled}
        className="h-8 shrink-0 justify-center gap-2 px-3"
      >
        <Play className="h-4 w-4" />
        <span className="truncate">
          {advancing
            ? translate("shell.header.advanceMonth.advancing")
            : translate("shell.header.advanceMonth.label")}
        </span>
      </Button>
    </Tip>
  );
}
