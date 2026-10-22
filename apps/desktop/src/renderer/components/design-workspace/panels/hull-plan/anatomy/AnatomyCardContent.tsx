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
    <div className="space-y-1" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <span className="truncate text-xs font-medium">{title}</span>
        {aside !== undefined && (
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
            {aside}
          </span>
        )}
      </div>
      <AnatomyShipFigure ship={plate} highlight={highlight} />
      <p className="min-h-4 px-1 text-xs leading-snug text-muted-foreground">
        {detail ?? plate.facts.get(highlight) ?? "Fitted equipment"}
      </p>
    </div>
  );
}
