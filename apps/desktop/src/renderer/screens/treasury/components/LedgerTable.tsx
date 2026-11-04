import { createContext, useContext, type ReactNode } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";

const ROW_BASE =
  "grid w-full items-center gap-x-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring";

const LAYOUT = {
  appropriation: "grid-cols-[0.75rem_minmax(0,1fr)_minmax(3rem,8rem)_5rem_3rem]",
  upkeep: "grid-cols-[0.75rem_minmax(0,1fr)_minmax(3rem,8rem)_4rem_5.5rem]",
  projects: "grid-cols-[minmax(0,1fr)_minmax(3rem,7rem)_4.5rem_6rem]",
} as const;

export type LedgerTableLayout = keyof typeof LAYOUT;

const LayoutContext = createContext<LedgerTableLayout>("appropriation");

function Root({
  layout,
  children,
}: {
  readonly layout: LedgerTableLayout;
  readonly children: ReactNode;
}) {
  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>;
}

export interface LedgerTableRowProps {
  readonly ariaLabel: string;
  readonly detail: ReactNode;
  readonly detailSide?: "left" | "bottom";
  readonly className?: string;
  readonly onMouseEnter?: () => void;
  readonly onMouseLeave?: () => void;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  readonly onClick?: () => void;
  readonly children: ReactNode;
}

function Row({
  ariaLabel,
  detail,
  detailSide = "left",
  className,
  children,
  ...handlers
}: LedgerTableRowProps) {
  const layout = useContext(LayoutContext);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={<button type="button" />}
        aria-label={ariaLabel}
        className={cn(ROW_BASE, LAYOUT[layout], className)}
        {...handlers}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent side={detailSide} align="center" className="w-72">
        {detail}
      </HoverCardContent>
    </HoverCard>
  );
}

function Bar({
  share,
  className,
  fillClassName,
}: {
  readonly share: number | null;
  readonly className?: string;
  readonly fillClassName: string;
}) {
  return (
    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
      {share !== null && (
        <span
          className={cn("block h-full rounded-full", fillClassName, className)}
          style={{ width: `${share * 100}%` }}
        />
      )}
    </span>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border" />;
}

export const LedgerTable = { Root, Row, Bar, Divider };
