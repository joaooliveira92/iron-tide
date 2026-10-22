import { BookOpen, CalendarClock, Sparkles } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField } from "../../../components/design-workspace/index.js";
import { cn } from "../../../lib/utils.js";
import type { DesignStatus } from "./CommandBar.js";

export interface DesignMapFooterProps {
  readonly month: string;
  readonly months: readonly string[] | null;
  readonly onMonth: (month: string) => void;
  readonly status: DesignStatus;
  readonly onStatusAction?: () => void;
  readonly names?: {
    readonly onSuggest: () => void;
    readonly onBrowse: () => void;
    readonly canSuggest: boolean;
  };
}

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
