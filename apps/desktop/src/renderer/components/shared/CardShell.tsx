import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/glass-card.js";
import { CardDescription, CardHeader, CardContent } from "../ui/card.js";

export type CardShellVariant = "card" | "embedded";

export interface CardShellProps {
  readonly testId: string;
  readonly variant?: CardShellVariant;
  readonly title: ReactNode;
  readonly description?: string;
  readonly contentClassName: string;
  readonly children: ReactNode;
}

export function CardShell({
  testId,
  variant = "card",
  title,
  description,
  contentClassName,
  children,
}: CardShellProps) {
  if (variant === "embedded") {
    return (
      <div data-testid={testId} className={contentClassName}>
        {description === undefined ? null : <p className="text-muted-foreground">{description}</p>}
        {children}
      </div>
    );
  }
  return (
    <GlassCard glassVariant="liquid-refract" data-testid={testId}>
      <CardHeader className="pb-3">
        {title}
        {description === undefined ? null : <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </GlassCard>
  );
}
