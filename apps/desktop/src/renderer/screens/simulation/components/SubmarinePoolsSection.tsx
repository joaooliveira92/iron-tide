import type { SubmarinePool } from "@bluewave/campaign-engine";
import { Map } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { Badge } from "../../../components/ui/badge.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "../../../components/ui/item.js";
import { nationDisplayName } from "../../../content/nationDisplayName.js";

interface SubmarinePoolsSectionProps {
  readonly pools: readonly SubmarinePool[];
}

/** Submarine deployments available per nation for the current theater. */
export function SubmarinePoolsSection({ pools }: SubmarinePoolsSectionProps) {
  return (
    <AccordionItem value="subs">
      <AccordionTrigger>
        <span className="flex items-center gap-1.5">
          <Map className="h-4 w-4 text-primary" />
          Submarine Warfare Pools
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {pools.length === 0 ? (
          <Empty>
            <EmptyIcon>
              <Map />
            </EmptyIcon>
            <EmptyTitle>No submarine deployments</EmptyTitle>
            <EmptyDescription>Nothing reported for the current theater yet.</EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-2">
            {pools.map((pool, idx) => (
              <Item key={idx}>
                <ItemContent>
                  <ItemTitle>{nationDisplayName(pool.nationId)}</ItemTitle>
                  <ItemDescription className="font-mono">{pool.submarineType}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="secondary" className="font-mono text-[12px]">
                    {pool.available} available
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
