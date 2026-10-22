import type { LandTargetDamage } from "@bluewave/campaign-engine";
import { Shield } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { Badge } from "../../../components/ui/badge.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { Item, ItemActions, ItemContent, ItemTitle } from "../../../components/ui/item.js";

interface CoastalDefensesSectionProps {
  readonly targets: readonly LandTargetDamage[];
}

export function CoastalDefensesSection({ targets }: CoastalDefensesSectionProps) {
  return (
    <AccordionItem value="defenses">
      <AccordionTrigger>
        <span className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-primary" />
          Coastal Defenses & Batteries
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {targets.length === 0 ? (
          <Empty>
            <EmptyIcon>
              <Shield />
            </EmptyIcon>
            <EmptyTitle>No fortified land targets</EmptyTitle>
            <EmptyDescription>Nothing reported for coastal batteries yet.</EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-2">
            {targets.map((def, idx) => (
              <Item key={idx}>
                <ItemContent>
                  <ItemTitle className="font-normal" title={def.landTargetId}>
                    {def.landTargetId}
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Badge
                    variant={def.state === "intact" ? "default" : "destructive"}
                    className="font-mono text-[12px] uppercase"
                  >
                    {def.state}
                  </Badge>
                </ItemActions>
              </Item>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
