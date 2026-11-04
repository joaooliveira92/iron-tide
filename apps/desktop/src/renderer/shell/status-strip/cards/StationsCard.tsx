import { Flag, Ship } from "lucide-react";

import type { StationDetail } from "../../status-strip-state.js";
import { formatTons } from "../../status-strip-state.js";
import { usePresentationFormat } from "../../usePresentationFormat.js";
import { CardFoot, CardHeader, StripGlyph } from "../StripGlyph.js";

export function StationsCard({ stations }: { readonly stations: StationDetail }) {
  const format = usePresentationFormat();
  const byTonnage = stations.foreignTonsFraction !== null;
  const share = byTonnage
    ? stations.foreignTonsFraction
    : stations.total === 0
      ? 0
      : stations.foreign / stations.total;
  return (
    <>
      <CardHeader title="Foreign stations" icon={<Flag className="size-3.5" />} />
      <div className="space-y-3 px-3 py-3">
        {stations.unknown ? (
          <p className="text-xs text-muted-foreground">
            The map could not be read, so the split cannot be shown.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <StripGlyph
                variant="meter"
                fraction={share ?? 0}
                fill="bg-admiralty-signal"
                className="h-2"
              />
              <p className="text-xs tabular-nums text-muted-foreground">
                {stations.foreign} of {stations.total} {stations.total === 1 ? "ship" : "ships"} in
                areas held by another nation
              </p>
              {stations.foreignTons !== null && stations.totalTons !== null && (
                <p
                  data-stat="foreign-tons"
                  className="font-display text-base font-semibold tabular-nums text-foreground"
                >
                  {stations.foreignTons} of {stations.totalTons}
                </p>
              )}
            </div>
            {stations.foreignGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Every ship is in your own areas or an unclaimed sea.
              </p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                {stations.foreignGroups.map((group) => (
                  <li
                    key={group.areaId}
                    data-area={group.areaId}
                    className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1 font-medium">
                        <Ship
                          className="size-3 shrink-0 text-admiralty-signal"
                          aria-hidden="true"
                        />
                        <span className="truncate">{group.areaName}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {group.ships.length} {group.ships.length === 1 ? "ship" : "ships"}
                        {group.tons !== null && ` · ${group.tons}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Held by {group.controller}</p>
                    <ul className="mt-1 border-t border-border/50 pt-1 text-xs leading-snug">
                      {group.ships.map((ship) => (
                        <li key={ship.name} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate">{ship.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {ship.tons === null ? "tonnage unknown" : formatTons(ship.tons, format)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <CardFoot>
        {stations.foreignTons === null && !stations.unknown && stations.foreign > 0
          ? "Tonnage is left out because at least one ship's design displacement is not loaded; a partial total would mislead."
          : "Tonnage is each ship's design displacement in metric tons. The bar shows the foreign share by tonnage."}
      </CardFoot>
    </>
  );
}
