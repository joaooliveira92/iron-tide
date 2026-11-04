import { Anchor } from "lucide-react";

import type { PortDetail } from "../../status-strip-state.js";
import { CardFoot, CardHeader, StripGlyph } from "../StripGlyph.js";

export function ShipyardCard({
  ports,
  total,
}: {
  readonly ports: readonly PortDetail[];
  readonly total: string;
}) {
  return (
    <>
      <CardHeader
        title="Shipyard capacity"
        icon={<Anchor className="size-3.5" />}
        aside={<span className="font-display text-sm font-semibold tabular-nums">{total}</span>}
      />
      <div className="px-3 py-3">
        {ports.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ports are listed for this nation.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {ports.map((port) => (
              <li key={port.id} data-port={port.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{port.name}</span>
                    <span className="text-muted-foreground"> · {port.areaName}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{port.capacity}</span>
                </div>
                <StripGlyph variant="meter" fraction={port.fraction} fill="bg-admiralty-signal" />
              </li>
            ))}
          </ul>
        )}
      </div>
      <CardFoot>
        The sum of your ports&rsquo; levels, a stand-in for RTW3 shipyard capacity until per-port
        facilities land.
      </CardFoot>
    </>
  );
}
