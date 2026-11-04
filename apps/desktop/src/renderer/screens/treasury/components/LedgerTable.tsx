import { createContext, useContext, type ReactNode } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";

const ROW_BASE =
  "grid w-full items-center gap-x-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring";

const COLUMNS = {
  flow: "grid-cols-[0.75rem_minmax(0,1fr)_minmax(3rem,8rem)_5rem_3rem]",
  fleet: "grid-cols-[0.75rem_minmax(0,1fr)_minmax(3rem,8rem)_4rem_5.5rem]",
  construction: "grid-cols-[minmax(0,1fr)_minmax(3rem,7rem)_4.5rem_6rem]",
} as const;

export type LedgerColumns = keyof typeof COLUMNS;

const ColumnsContext = createContext<LedgerColumns>("flow");

interface LedgerTableProps {
  readonly columns: LedgerColumns;
  readonly testId?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

function Root({ columns, testId, className, children }: LedgerTableProps) {
  return (
    <ColumnsContext.Provider value={columns}>
      <div className={cn("space-y-0.5", className)} data-testid={testId}>
        {children}
      </div>
    </ColumnsContext.Provider>
  );
}

interface RowProps {
  readonly ariaLabel: string;
  readonly detail: ReactNode;
  readonly highlighted?: boolean;
  readonly dimmed?: boolean;
  readonly onActive?: (active: boolean) => void;
  readonly onOpen?: () => void;
  readonly children: ReactNode;
}

function Row({
  ariaLabel,
  detail,
  highlighted = false,
  dimmed = false,
  onActive,
  onOpen,
  children,
}: RowProps) {
  const columns = useContext(ColumnsContext);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={<button type="button" />}
        onMouseEnter={() => onActive?.(true)}
        onMouseLeave={() => onActive?.(false)}
        onFocus={() => onActive?.(true)}
        onBlur={() => onActive?.(false)}
        onClick={onOpen}
        aria-label={ariaLabel}
        className={cn(
          ROW_BASE,
          COLUMNS[columns],
          highlighted && "bg-muted/60",
          dimmed && "opacity-60",
        )}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent side="left" align="center" className="w-72">
        {detail}
      </HoverCardContent>
    </HoverCard>
  );
}

function Swatch({
  className,
  variant = "solid",
}: {
  readonly className?: string;
  readonly variant?: "solid" | "dashed";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2.5 rounded-sm",
        className ?? "bg-foreground",
        variant === "dashed" && "border border-dashed border-foreground/60 bg-transparent",
      )}
    />
  );
}

function Label({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return <span className={className}>{children}</span>;
}

export const GROWING_FILL =
  "transition-[width] duration-500 ease-out motion-reduce:transition-none";

function Bar({
  share,
  fillClassName,
}: {
  readonly share: number | null;
  readonly fillClassName?: string;
}) {
  return (
    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
      {share !== null && (
        <span
          className={cn("block h-full rounded-full", fillClassName)}
          style={{ width: `${Math.min(1, share) * 100}%` }}
        />
      )}
    </span>
  );
}

function Amount({ children }: { readonly children: ReactNode }) {
  return <span className="text-right font-medium tabular-nums">{children}</span>;
}

function Note({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <span className={cn("text-right text-xs tabular-nums text-muted-foreground", className)}>
      {children}
    </span>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border" />;
}

export const LedgerTable = { Root, Row, Swatch, Label, Bar, Amount, Note, Divider };
