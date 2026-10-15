import type { ReactNode } from "react";
import { CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { GlassCard } from "../ui/glass-card.js";

export interface GlassSectionCardProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/**
 * A titled `GlassCard` section with an icon and optional description — the
 * shared chrome both the Research and Diplomacy screens used to duplicate.
 */
export function GlassSectionCard({ icon, title, description, children }: GlassSectionCardProps) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
        {description !== undefined && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </GlassCard>
  );
}
