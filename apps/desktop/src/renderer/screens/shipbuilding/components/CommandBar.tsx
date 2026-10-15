import { Fragment, type ReactNode } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GitCompare,
  MoreHorizontal,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import { Separator } from "../../../components/ui/separator.js";
import {
  SHORTCUT_MOD,
  SHORTCUT_SHIFT,
  SelectField,
} from "../../../components/design-workspace/index.js";
import { cn } from "../../../lib/utils.js";

export interface CommandBarOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

export interface DesignStatus {
  /** "Can be submitted" or "Cannot be built". */
  readonly label: string;
  readonly tone: "ok" | "bad";
  /** e.g. "1 blocking · 2 warnings". */
  readonly detail: string;
}

export interface CommandBarProps {
  /** The class the design will be built as; it names the design on submission. */
  readonly shipClassName: string;
  readonly onShipClassName: (name: string) => void;
  readonly shipType: string;
  readonly shipTypes: readonly CommandBarOption[];
  readonly onShipType: (type: string) => void;
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
  readonly onSave: (() => void) | null;
  readonly saveLabel: string;
  readonly onValidate: () => void;
  readonly onFinish: () => void;
  /** Whole-design actions kept out of the way: reset, start from another design, import or export. */
  readonly overflow: readonly {
    readonly label: string;
    readonly onSelect: () => void;
    readonly destructive?: boolean;
  }[];
}

/**
 * The top bar answers "which design am I editing, and what can I do with the whole design?". It holds design-level
 * commands only: no ordinary ship parameter lives here.
 */
export function CommandBar({
  shipClassName,
  onShipClassName,
  shipType,
  shipTypes,
  onShipType,
  month,
  months,
  onMonth,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  compare,
  onSave,
  saveLabel,
  onValidate,
  onFinish,
  overflow,
}: CommandBarProps) {
  return (
    <div
      role="group"
      aria-label="Design commands"
      className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2"
    >
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Class name
        <input
          aria-label="Class name"
          className="h-9 w-48 rounded-md border bg-background px-2 text-sm text-foreground"
          placeholder="Unnamed class"
          value={shipClassName}
          maxLength={60}
          onChange={(e) => onShipClassName(e.target.value)}
        />
      </label>
      <SelectField
        inline
        className="w-72 min-w-0 [&>*]:min-w-0"
        label="Ship type"
        value={shipType}
        options={shipTypes}
        onChange={onShipType}
      />
      {months === null ? (
        <span
          className="flex h-9 shrink-0 items-center gap-1.5 px-1 text-sm tabular-nums"
          title="Fixed to the campaign date: the design can use only what your navy has this month."
        >
          <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="sr-only">Technology as of </span>
          {month}
          <span className="sr-only"> (campaign date)</span>
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
        variant={status.tone === "ok" ? "secondary" : "destructive"}
        title={status.detail}
      >
        <span className="sr-only">Design status: </span>
        {status.label}
        <span className="sr-only">, {status.detail}</span>
      </Badge>
      <Separator orientation="vertical" className="h-6" />
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
          {overflow.map((item, i) => (
            <Fragment key={item.label}>
              {item.destructive && i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem destructive={item.destructive} onClick={item.onSelect}>
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          disabled={onSave === null}
          onClick={onSave ?? undefined}
          title={onSave === null ? "Drafts are saved inside a campaign only." : undefined}
        >
          <Save aria-hidden="true" className="mr-1 size-4" />
          {saveLabel}
        </Button>
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
