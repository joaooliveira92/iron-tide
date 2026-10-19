import { Fragment, type ReactNode, type Ref } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GitCompare,
  MoreHorizontal,
  Redo2,
  Check,
  Undo2,
} from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import {
  SHORTCUT_MOD,
  SHORTCUT_SHIFT,
  SelectField,
} from "../../../components/design-workspace/index.js";
import { cn } from "../../../lib/utils.js";

export interface DesignStatus {
  /** "Can be submitted" or "Cannot be built". */
  readonly label: string;
  readonly tone: "ok" | "warn" | "bad";
  /** e.g. "1 blocking · 2 warnings". */
  readonly detail: string;
}

export interface CommandBarProps {
  /** The class the design will be built as; it names the design on submission. */
  readonly shipClassName: string;
  readonly onShipClassName: (name: string) => void;
  /** Lets the host move focus to the class name, e.g. when finishing a design that has none. */
  readonly nameInputRef?: Ref<HTMLInputElement>;
  /** Opens the "Start from a reference design" browser, which is how a design's ship type is chosen. */
  readonly onStartFromReference: () => void;
  /** The design's current ship type, kept visible on the reference button: its code, full name and icon. */
  readonly shipType: string;
  readonly shipTypeLabel: string;
  readonly shipTypeIcon: ReactNode;
  /** The technology date: fixed to the campaign month in a campaign, chosen outside one. */
  readonly month: string;
  readonly months: readonly string[] | null;
  readonly onMonth: (month: string) => void;
  readonly status: DesignStatus;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  /** The "compared with the starting design" readout, shown in a popover. */
  readonly compare: ReactNode;
  /** True when the design is autosaved (inside a campaign); the bar then says so instead of offering a save button. */
  readonly autosaved: boolean;
  readonly onValidate: () => void;
  readonly onFinish: () => void;
  /** Whole-design actions kept out of the way, in labelled groups: import or export, history, reset. */
  readonly overflow: readonly {
    readonly label: string;
    readonly items: readonly {
      readonly label: string;
      readonly onSelect: () => void;
      readonly destructive?: boolean;
    }[];
  }[];
}

/**
 * The top bar answers "which design am I editing, and what can I do with the whole design?". It holds design-level
 * commands only: no ordinary ship parameter lives here.
 */
export function CommandBar({
  shipClassName,
  onShipClassName,
  nameInputRef,
  onStartFromReference,
  shipType,
  shipTypeLabel,
  shipTypeIcon,
  month,
  months,
  onMonth,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  compare,
  autosaved,
  onValidate,
  onFinish,
  overflow,
}: CommandBarProps) {
  return (
    <div
      role="group"
      aria-label="Design commands"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-3 py-2"
    >
      <div className="flex min-w-0 flex-1 basis-[28rem] flex-wrap items-center gap-2">
        <label className="flex min-w-40 max-w-xs flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Class name</span>
          <input
            ref={nameInputRef}
            aria-label="Class name"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm text-foreground"
            placeholder="Unnamed class"
            value={shipClassName}
            maxLength={60}
            onChange={(e) => onShipClassName(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          className="gap-1.5"
          title={`Current type: ${shipTypeLabel}. Pick a reference design to start from another type.`}
          onClick={onStartFromReference}
        >
          {shipTypeIcon}
          Start from a reference design
          <Badge
            variant="secondary"
            className="ml-1 px-1.5 py-0"
            aria-label={`Current type ${shipType}`}
          >
            {shipType}
          </Badge>
        </Button>
        {months === null ? (
          <span
            className="flex h-9 shrink-0 items-center gap-1.5 px-1 text-sm tabular-nums"
            title="Fixed to the campaign date: the design can use only what your navy has this month."
          >
            <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tech date</span>
            <span className="sr-only"> (campaign date) </span>
            {month}
          </span>
        ) : (
          <SelectField
            inline
            label="Technology as of"
            shortLabel="Year"
            value={month}
            options={months.map((m) => ({ value: m, label: m }))}
            onChange={onMonth}
          />
        )}
        <Badge
          role="status"
          variant={
            status.tone === "ok" ? "secondary" : status.tone === "warn" ? "outline" : "destructive"
          }
          title={status.detail}
        >
          <span className="sr-only">Design status: </span>
          {status.label}
          <span className="sr-only">, {status.detail}</span>
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ButtonGroup aria-label="History">
          <Button
            variant="outline"
            size="icon"
            aria-label="Undo"
            title={`Undo (${SHORTCUT_MOD}Z)`}
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Redo"
            title={`Redo (${SHORTCUT_SHIFT}${SHORTCUT_MOD}Z)`}
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 aria-hidden="true" />
          </Button>
        </ButtonGroup>
        <Popover>
          <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
            <GitCompare aria-hidden="true" className="size-4" />
            Compare
          </PopoverTrigger>
          <PopoverContent aria-label="Compare with the starting design" className="w-96 p-0">
            {compare}
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More design actions"
            className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {overflow.map((group, g) => (
              <Fragment key={group.label}>
                {g > 0 && <DropdownMenuSeparator />}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                  {group.items.map((item) => (
                    <DropdownMenuItem
                      key={item.label}
                      destructive={item.destructive}
                      onClick={item.onSelect}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {autosaved && (
          <span
            role="note"
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title="Every change is saved to this campaign as you work."
          >
            <Check aria-hidden="true" className="size-3.5" />
            Autosaved
          </span>
        )}
        <Button variant="outline" onClick={onValidate}>
          <ClipboardCheck aria-hidden="true" className="mr-1 size-4" />
          Validate
        </Button>
        <Button onClick={onFinish}>
          <CheckCircle2 aria-hidden="true" className="mr-1 size-4" />
          Finish design
        </Button>
      </div>
    </div>
  );
}
