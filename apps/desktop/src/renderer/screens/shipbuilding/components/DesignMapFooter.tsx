import { BookOpen, CalendarClock, Sparkles } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
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
  /** The class-name helpers above the status; omitted, the buttons are not shown. */
  readonly names?: {
    /** Puts the next suggested name for this nation and ship type in the class name field. */
    readonly onSuggest: () => void;
    /** Opens the list of the nation's names to choose from. */
    readonly onBrowse: () => void;
    /** False when the nation has no names for this ship type: Suggest is then disabled. */
    readonly canSuggest: boolean;
  };
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
  names,
}: DesignMapFooterProps) {
  const badge = (
    <Badge
      role={onStatusAction === undefined ? "status" : undefined}
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
      {names !== undefined && (
        <div role="group" aria-label="Class name" className="flex gap-1 max-xl:flex-col">
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 gap-1.5 max-xl:px-2"
            disabled={!names.canSuggest}
            aria-label="Suggest a class name"
            title="Fill in a name from this nation's list for this ship type; press again for the next"
            onClick={names.onSuggest}
          >
            <Sparkles aria-hidden="true" />
            <span className="max-xl:sr-only">Suggest</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 gap-1.5 max-xl:px-2"
            aria-label="Browse class names"
            title="Choose from this nation's ship names"
            onClick={names.onBrowse}
          >
            <BookOpen aria-hidden="true" />
            <span className="max-xl:sr-only">Names</span>
          </Button>
        </div>
      )}
      {onStatusAction === undefined ? (
        badge
      ) : (
        // A live region inside a button is dropped from the button's name, so the name is explicit.
        <div role="status">
          <button
            type="button"
            onClick={onStatusAction}
            aria-label={`${status.label}, ${status.detail}. Activate to fix`}
            title={`${status.label}: click to fix`}
            className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring max-xl:flex"
          >
            {badge}
          </button>
        </div>
      )}
    </div>
  );
}
