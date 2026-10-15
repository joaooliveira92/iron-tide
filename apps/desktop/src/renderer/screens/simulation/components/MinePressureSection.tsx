import type { MinePressure } from "@bluewave/campaign-engine";
import { ShieldAlert } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { Progress } from "../../../components/ui/progress.js";

interface MinePressureSectionProps {
  readonly pressure: readonly MinePressure[];
}

/** Mine pressure per sea zone: freshness and detection confidence. */
export function MinePressureSection({ pressure }: MinePressureSectionProps) {
  return (
    <AccordionItem value="mines">
      <AccordionTrigger>
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Sea Mine Pressure Map
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {pressure.length === 0 ? (
          <Empty>
            <EmptyIcon>
              <ShieldAlert />
            </EmptyIcon>
            <EmptyTitle>No active minefields</EmptyTitle>
            <EmptyDescription>No sea zones currently report mine pressure.</EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-3">
            {pressure.map((p, idx) => (
              <div key={idx} className="space-y-1.5 rounded-md border p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {p.areaId === "area_mediterranean" ? "Mediterranean" : p.areaId}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    Sources: {p.sources.length}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>Freshness</span>
                    <span>{p.freshness}%</span>
                  </div>
                  <Progress value={p.freshness} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>Detection confidence</span>
                    <span>{p.detectionConfidence}%</span>
                  </div>
                  <Progress value={p.detectionConfidence} />
                </div>
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
