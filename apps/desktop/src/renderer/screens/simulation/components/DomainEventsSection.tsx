import type { DomainEvent } from "@bluewave/campaign-engine";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { Badge } from "../../../components/ui/badge.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";

interface DomainEventsSectionProps {
  readonly events: readonly DomainEvent[];
}

/** The month's domain events, straight from the commit response. */
export function DomainEventsSection({ events }: DomainEventsSectionProps) {
  return (
    <AccordionItem value="events">
      <AccordionTrigger className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Domain Events
      </AccordionTrigger>
      <AccordionContent>
        <ScrollArea className="h-[140px] rounded-md border bg-muted/20">
          <div className="space-y-1 p-2">
            {events.map((evt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between border-b p-1 font-mono text-[11px] last:border-0"
              >
                <span className="text-foreground">{evt.kind}</span>
                <Badge variant="secondary" className="scale-90 text-[11px] uppercase">
                  {evt.phase}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </AccordionContent>
    </AccordionItem>
  );
}
