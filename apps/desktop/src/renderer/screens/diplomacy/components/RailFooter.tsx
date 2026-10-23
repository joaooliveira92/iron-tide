import { CalendarClock } from "lucide-react";
import { cn } from "../../../lib/utils.js";

export interface RailFooterProps {
  readonly month: string;
  readonly atWar: boolean;
}

export function RailFooter({ month, atWar }: RailFooterProps) {
  return (
    <div className="mt-1 space-y-2 border-t pt-2 max-xl:hidden">
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <CalendarClock aria-hidden="true" className="size-4" />
        Month
        <span className="font-medium tabular-nums text-foreground">{month}</span>
      </p>
      <p
        className={cn(
          "w-fit rounded-md border px-2 py-1 text-xs font-medium",
          atWar && "border-destructive/50 text-destructive",
        )}
      >
        {atWar ? "At war" : "At peace"}
      </p>
    </div>
  );
}
