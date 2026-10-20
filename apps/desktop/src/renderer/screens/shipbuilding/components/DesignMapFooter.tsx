import { CalendarClock } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { SelectField } from "../../../components/design-workspace/index.js";
import { cn } from "../../../lib/utils.js";
import type { DesignStatus } from "./CommandBar.js";

export interface DesignMapFooterProps {
  /** The technology date: fixed to the campaign month in a campaign, chosen outside one. */
  readonly month: string;
  readonly months: readonly string[] | null;
  readonly onMonth: (month: string) => void;
  readonly status: DesignStatus;
  /** What fixes the status (e.g. focus the class name): when given, the status becomes a button that runs it. */
  readonly onStatusAction?: () => void;
}

/**
 * The foot of the left rail: the design's technology date and whether it can be submitted. Both describe the whole
 * design, so they sit with the design map rather than in the command bar. Below extra-large widths the rail is icon
 * width, so the date shrinks to its text and the status to a dot, each keeping its full spoken name.
 */
export function DesignMapFooter({
  month,
  months,
  onMonth,
  status,
  onStatusAction,
}: DesignMapFooterProps) {
  const badge = (
    <Badge
      role="status"
      variant={
        status.tone === "ok" ? "secondary" : status.tone === "warn" ? "outline" : "destructive"
      }
      title={status.detail}
      className={cn("justify-center max-xl:size-3 max-xl:rounded-full max-xl:p-0")}
    >
      <span className="sr-only">Design status: </span>
      <span className="max-xl:sr-only">{status.label}</span>
      <span className="sr-only">, {status.detail}</span>
    </Badge>
  );
  return (
    <div className="mt-auto flex flex-col gap-2 border-t pt-2 max-xl:items-center">
      {months === null ? (
        <div
          className="flex items-center gap-1.5 px-1 text-sm tabular-nums max-xl:flex-col max-xl:gap-0.5 max-xl:px-0 max-xl:text-[0.625rem]"
          title="Fixed to the campaign date: the design can use only what your navy has this month."
        >
          <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground max-xl:sr-only">Tech date</span>
          <span>{month}</span>
          <span className="sr-only"> (campaign date)</span>
        </div>
      ) : (
        <SelectField
          inline
          className="w-full min-w-0 [&>*]:min-w-0"
          label="Technology as of"
          shortLabel="Year"
          value={month}
          options={months.map((m) => ({ value: m, label: m }))}
          onChange={onMonth}
        />
      )}
      {onStatusAction === undefined ? (
        badge
      ) : (
        <button
          type="button"
          onClick={onStatusAction}
          title={`${status.label}: click to fix`}
          className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring max-xl:flex"
        >
          {badge}
        </button>
      )}
    </div>
  );
}
