import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/glass-card.js";
import { CardContent, CardHeader } from "../ui/card.js";

export interface CardShellProps {
  readonly testId: string;
  /** The card's title block (CardTitle / CardDescription). Dropped when `embedded`. */
  readonly header: ReactNode;
  readonly contentClassName: string;
  /**
   * True when a host panel already supplies the chrome and title (e.g. a collapsible map overlay):
   * only the body renders, with no card surface or header.
   */
  readonly embedded: boolean;
  readonly children: ReactNode;
}

/** A glass card with a header, or just its body when embedded in a host panel. */
export function CardShell({
  testId,
  header,
  contentClassName,
  embedded,
  children,
}: CardShellProps) {
  if (embedded) {
    return (
      <div data-testid={testId} className={contentClassName}>
        {children}
      </div>
    );
  }
  return (
    <GlassCard glassVariant="liquid-refract" data-testid={testId}>
      <CardHeader className="pb-3">{header}</CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </GlassCard>
  );
}
