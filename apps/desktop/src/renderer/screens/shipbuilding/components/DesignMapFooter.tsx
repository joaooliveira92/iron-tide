import { BookOpen, CalendarClock, Sparkles } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { SelectField } from "../../../components/design-workspace/index.js";
import { cn } from "../../../lib/utils.js";
import type { DesignStatus } from "./CommandBar.js";
import { Tip } from "../../../components/ui/tip.js";

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
    <Tip label={status.detail}>
      <Badge
        role={onStatusAction === undefined ? "status" : undefined}
        variant={
          status.tone === "ok" ? "secondary" : status.tone === "warn" ? "outline" : "destructive"
        }

        className={cn("justify-center max-xl:size-3 max-xl:rounded-full max-xl:p-0")}
      >
        <span className="sr-only">Design status: </span>
        <span className="max-xl:sr-only">{status.label}</span>
        <span className="sr-only">, {status.detail}</span>
      </Badge>
    </Tip>
  );
  return (
    <div className="mt-auto flex flex-col gap-2 border-t pt-2 max-xl:items-center">
      {months === null ? (
        <Tip label="Fixed to the campaign date: the design can use only what your navy has this month.">
          <div className="flex items-center gap-1.5 px-1 text-sm tabular-nums max-xl:flex-col max-xl:gap-0.5 max-xl:px-0 max-xl:text-[0.625rem]">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground max-xl:sr-only">Tech date</span>
            <span>{month}</span>
            <span className="sr-only"> (campaign date)</span>
          </div>
        </Tip>
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
          <Tip label="Fill in a name from this nation's list for this ship type; press again for the next">
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 gap-1.5 max-xl:px-2"
              disabled={!names.canSuggest}
              aria-label="Suggest a class name"

              onClick={names.onSuggest}
            >
              <Sparkles aria-hidden="true" />
              <span className="max-xl:sr-only">Suggest</span>
            </Button>
          </Tip>
          <Tip label="Choose from this nation's ship names">
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 gap-1.5 max-xl:px-2"
              aria-label="Browse class names"

              onClick={names.onBrowse}
            >
              <BookOpen aria-hidden="true" />
              <span className="max-xl:sr-only">Names</span>
            </Button>
          </Tip>
        </div>
      )}
      {onStatusAction === undefined ? (
        badge
      ) : (
        <div role="status">
          <Tip label={`${status.label}: click to fix`}>
            <button
              type="button"
              onClick={onStatusAction}
              aria-label={`${status.label}, ${status.detail}. Activate to fix`}

              className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring max-xl:flex"
            >
              {badge}
            </button>
          </Tip>
        </div>
      )}
    </div>
  );
}
