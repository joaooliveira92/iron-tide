import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui/glass-card.js";
import { CardContent, CardHeader } from "../ui/card.js";

export interface CardShellProps {
  readonly testId: string;
  readonly header: ReactNode;
  readonly contentClassName: string;
  readonly embedded: boolean;
  readonly children: ReactNode;
}

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
