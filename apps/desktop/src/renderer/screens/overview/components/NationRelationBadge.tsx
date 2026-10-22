import { Anchor, Coins, Crown, Handshake, ShieldCheck, Swords } from "lucide-react";
import type { ComponentType } from "react";

import { Badge } from "../../../components/ui/badge.js";
import { cn } from "../../../lib/utils.js";
import type { NationRailRelation, NationRailRow } from "../nation-rail-state.js";

const RELATION_STYLE: Readonly<
  Record<
    NationRailRelation,
    {
      readonly icon: ComponentType<{ className?: string }>;
      readonly badge: string;
      readonly tint: string;
    }
  >
> = {
  self: {
    icon: Crown,
    badge: "border-primary/40 bg-primary/10",
    tint: "text-primary",
  },
  peace: {
    icon: Anchor,
    badge: "border-border bg-muted/40",
    tint: "text-muted-foreground",
  },
  pact: {
    icon: ShieldCheck,
    badge: "border-border bg-muted/40",
    tint: "text-muted-foreground",
  },
  alliance: {
    icon: Handshake,
    badge: "border-success/40 bg-success/10",
    tint: "text-success",
  },
  trade: {
    icon: Coins,
    badge: "border-success/40 bg-success/10",
    tint: "text-success",
  },
  war: {
    icon: Swords,
    badge: "border-destructive/40 bg-destructive/10",
    tint: "text-destructive",
  },
};

export function NationRelationBadge({ row }: { readonly row: NationRailRow }) {
  const style = RELATION_STYLE[row.relation];
  const Icon = style.icon;
  return (
    <Badge
      variant="outline"
      data-relation={row.relation}
      className={cn(
        "shrink-0 gap-1 px-1.5 py-0 text-xs font-semibold uppercase tracking-wide text-foreground",
        style.badge,
      )}
    >
      <Icon className={cn("size-3", style.tint)} aria-hidden="true" />
      {row.relationLabel}
    </Badge>
  );
}
