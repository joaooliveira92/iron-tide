import type { ComponentSummary, PartCatalogueEntry, PlacementSpec } from "@bluewave/ship-design";
import { Badge } from "../../../ui/badge.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../../ui/hover-card.js";
import { SlateBody, SlateFacts, SlateHeader } from "../../../ui/slate.js";
import { cn } from "../../../../lib/utils.js";
import { KG_PER_TONNE } from "../../../../lib/presentation-format/units.js";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import { componentFacts } from "../../componentFacts.js";

export function ComponentHover({
  entry,
  placement,
  compiled,
  onSelect,
  selected,
}: {
  readonly entry: PartCatalogueEntry | undefined;
  readonly placement: PlacementSpec;
  readonly compiled: ComponentSummary | undefined;
  readonly onSelect?: () => void;
  readonly selected?: boolean;
}) {
  const format = usePresentationFormat();
  if (!entry) return <span>{placement.componentId}</span>;
  const facts = componentFacts(entry, compiled);
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={onSelect === undefined ? undefined : selected === true}
          />
        }
        className={cn(
          "cursor-help text-left underline decoration-dotted underline-offset-2",
          selected === true && "font-medium text-foreground",
        )}
      >
        {facts.name}
      </HoverCardTrigger>
      <HoverCardContent>
        <SlateHeader title={facts.name} />
        <SlateBody>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{facts.category}</Badge>
            {facts.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
          <SlateFacts
            rows={[
              { label: "Available from", value: facts.introduced },
              ...(facts.obsolete === null
                ? []
                : [{ label: "Obsolete from", value: facts.obsolete }]),
              ...(facts.placed === null
                ? []
                : [
                    {
                      label: "Weight as fitted",
                      value: format.measurement(facts.placed.weightT * KG_PER_TONNE, "mass", {
                        maximumFractionDigits: 1,
                      }),
                    },
                    { label: "Cost as fitted", value: format.money(facts.placed.costGbp) },
                  ]),
            ]}
          />
        </SlateBody>
      </HoverCardContent>
    </HoverCard>
  );
}
