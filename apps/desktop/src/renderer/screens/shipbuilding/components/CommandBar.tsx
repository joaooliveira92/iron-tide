import { Fragment, type ReactNode, type Ref } from "react";
import {
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
import { SHORTCUT_MOD, SHORTCUT_SHIFT } from "../../../components/design-workspace/index.js";
import { cn } from "../../../lib/utils.js";
import { Tip } from "../../../components/ui/tip.js";

export interface DesignStatus {
  readonly label: string;
  readonly tone: "ok" | "warn" | "bad";
  readonly detail: string;
}

export interface CommandBarProps {
  readonly shipClassName: string;
  readonly onShipClassName: (name: string) => void;
  readonly nameInputRef?: Ref<HTMLInputElement>;
  readonly onStartFromReference: () => void;
  readonly shipType: string;
  readonly shipTypeLabel: string;
  readonly shipTypeIcon: ReactNode;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly compare: ReactNode;
  readonly autosaved: boolean;
  readonly onValidate: () => void;
  readonly onFinish: () => void;
  readonly overflow: readonly {
    readonly label: string;
    readonly items: readonly {
      readonly label: string;
      readonly onSelect: () => void;
      readonly destructive?: boolean;
    }[];
  }[];
}

export function CommandBar({
  shipClassName,
  onShipClassName,
  nameInputRef,
  onStartFromReference,
  shipType,
  shipTypeLabel,
  shipTypeIcon,
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
        <Tip
          label={`Current type: ${shipTypeLabel}. Pick a reference design to start from another type.`}
        >
          <Button
            variant="outline"
            className="gap-1.5"

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
        </Tip>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ButtonGroup aria-label="History">
          <Tip label={`Undo (${SHORTCUT_MOD}Z)`}>
            <Button
              variant="outline"
              size="icon"
              aria-label="Undo"

              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 aria-hidden="true" />
            </Button>
          </Tip>
          <Tip label={`Redo (${SHORTCUT_SHIFT}${SHORTCUT_MOD}Z)`}>
            <Button
              variant="outline"
              size="icon"
              aria-label="Redo"

              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo2 aria-hidden="true" />
            </Button>
          </Tip>
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
          <Tip label="Every change is saved to this campaign as you work.">
            <span role="note" className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check aria-hidden="true" className="size-3.5" />
              Autosaved
            </span>
          </Tip>
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
