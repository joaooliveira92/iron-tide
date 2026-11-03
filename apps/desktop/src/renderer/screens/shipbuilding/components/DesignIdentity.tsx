import { BookOpen, CalendarClock, Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { SelectField } from "../../../components/design-workspace/fields.js";
import { Tip } from "../../../components/ui/tip.js";

export interface DesignIdentityProps {
  readonly month: string;
  readonly months: readonly string[] | null;
  readonly onMonth: (month: string) => void;
  readonly names?: {
    readonly onSuggest: () => void;
    readonly onBrowse: () => void;
    readonly canSuggest: boolean;
  };
}

export function DesignIdentity({ month, months, onMonth, names }: DesignIdentityProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {months === null ? (
        <Tip label="Fixed to the campaign date: the design can use only what your navy has this month.">
          <div className="flex items-center gap-1.5 text-sm tabular-nums">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tech date</span>
            <span>{month}</span>
            <span className="sr-only"> (campaign date)</span>
          </div>
        </Tip>
      ) : (
        <SelectField
          inline
          className="w-56 min-w-0"
          label="Technology as of"
          shortLabel="Year"
          value={month}
          options={months.map((m) => ({ value: m, label: m }))}
          onChange={onMonth}
        />
      )}
      {names !== undefined && (
        <div role="group" aria-label="Class name" className="ml-auto flex gap-1">
          <Tip label="Fill in a name from this nation's list for this ship type; press again for the next">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!names.canSuggest}
              aria-label="Suggest a class name"
              onClick={names.onSuggest}
            >
              <Sparkles aria-hidden="true" />
              Suggest
            </Button>
          </Tip>
          <Tip label="Choose from this nation's ship names">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="Browse class names"
              onClick={names.onBrowse}
            >
              <BookOpen aria-hidden="true" />
              Names
            </Button>
          </Tip>
        </div>
      )}
    </div>
  );
}
