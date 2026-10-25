import { SlateFoot, SlateHeader } from "../../../../ui/slate.js";
import { AnatomyShipFigure } from "./AnatomyShipFigure.js";
import type { AnatomyShip } from "./ship-anatomy.js";

export function AnatomyCardContent({
  plate,
  highlight,
  title,
  aside,
  detail,
  testId,
}: {
  readonly plate: AnatomyShip;
  readonly highlight: string;
  readonly title: string;
  readonly aside?: string;
  readonly detail?: string;
  readonly testId: string;
}) {
  return (
    <div data-testid={testId}>
      <SlateHeader
        title={title}
        {...(aside === undefined
          ? {}
          : {
              aside: (
                <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                  {aside}
                </span>
              ),
            })}
      />
      <div className="p-2">
        <AnatomyShipFigure ship={plate} highlight={highlight} />
      </div>
      <SlateFoot>{detail ?? plate.facts.get(highlight) ?? "Fitted equipment"}</SlateFoot>
    </div>
  );
}
