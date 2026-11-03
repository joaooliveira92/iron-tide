import type { ReactNode } from "react";
import { cn } from "../../../../lib/utils.js";

export type SummaryVariant = "turn" | "report";

export interface SummarySectionProps {
  readonly variant: SummaryVariant;
  readonly title: ReactNode;
  readonly count?: number;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly testId?: string;
  readonly category?: string;
  readonly children?: ReactNode;
}

export function SummarySection({
  variant,
  title,
  count,
  ariaLabel,
  className,
  testId,
  category,
  children,
}: SummarySectionProps) {
  if (variant === "turn") {
    return (
      <section data-testid={testId} data-category={category} className={className}>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {count === undefined ? (
            title
          ) : (
            <>
              {title} ({count})
            </>
          )}
        </h3>
        {children}
      </section>
    );
  }
  return (
    <section aria-label={ariaLabel} className={className}>
      <p className="font-medium">{title}</p>
      {children}
    </section>
  );
}

export interface SummaryListProps {
  readonly variant: SummaryVariant;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function SummaryList({ variant, ariaLabel, className, children }: SummaryListProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(variant === "turn" ? "space-y-1" : "text-muted-foreground", className)}
    >
      {children}
    </ul>
  );
}

export interface SummaryRowProps {
  readonly variant: SummaryVariant;
  readonly testId?: string;
  readonly messageId?: string;
  readonly severity?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function SummaryRow({
  variant,
  testId,
  messageId,
  severity,
  className,
  children,
}: SummaryRowProps) {
  if (variant === "turn") {
    return (
      <li
        data-testid={testId}
        data-message-id={messageId}
        data-severity={severity}
        className={cn("rounded-md border border-border/60 bg-background/60 p-2", className)}
      >
        {children}
      </li>
    );
  }
  return <li className={className}>{children}</li>;
}

export interface SummaryDeltaProps {
  readonly from: string;
  readonly to: string;
  readonly delta?: string;
}

export function SummaryDelta({ from, to, delta }: SummaryDeltaProps) {
  return (
    <>
      {from} → {to}
      {delta === undefined ? "" : ` (${delta})`}
    </>
  );
}

export function summaryDeltaLabel(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

export function summaryValueLabel(value: unknown): string {
  return String(value ?? "—");
}
