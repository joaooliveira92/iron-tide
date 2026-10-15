import {
  applyEdit,
  compileDesign,
  type DesignDraft,
  type DraftEdit,
  type PartCatalogueEntry,
  type ShipContext,
} from "@bluewave/ship-design";
import { placeEdit, type PlanEdit } from "./placement-edits.js";
import { zoneAtStation, type ZoneSpan } from "./plan-targeting.js";

/**
 * Auto-placement (ADR-0084): pick the legal station that leaves the ship most level. This is the only placement
 * concern that compiles candidate drafts, so it is kept apart from the pure edit builders in `placement-edits`.
 */

/** Stations auto-place tries: every 10 permille, keeping clear of the very ends. */
export const AUTO_PLACE_STATIONS: readonly number[] = Array.from(
  { length: 97 },
  (_, i) => 20 + i * 10,
);

/**
 * Auto-place (ADR-0084): of every station the component may legally go (same zone rules as a click, centreline), the one
 * that leaves the ship most level (smallest |trim|) without adding a blocking finding; a tie goes to the lowest station.
 * Pure and deterministic: it compiles each candidate with the board's own rules. Refused when no station qualifies.
 */
export function autoPlace(
  entry: PartCatalogueEntry,
  draft: DesignDraft,
  zones: readonly ZoneSpan[],
  ctx: ShipContext,
): PlanEdit & { readonly stationPermille?: number } {
  const blocking = (d: DesignDraft) =>
    compileDesign(d, ctx).findings.filter((f) => f.severity === "BLOCKING").length;
  const before = blocking(draft);
  let best: { edit: DraftEdit; trim: number; station: number } | null = null;
  for (const station of AUTO_PLACE_STATIONS) {
    const r = placeEdit(
      entry,
      { stationPermille: station, zoneId: zoneAtStation(zones, station), side: "CENTRE" },
      draft,
    );
    if (!r.ok) continue;
    const next = applyEdit(draft, r.edit);
    const c = compileDesign(next, ctx);
    if (c.findings.filter((f) => f.severity === "BLOCKING").length > before) continue;
    const trim = c.stability === null ? Infinity : Math.abs(c.stability.trimBp);
    if (best === null || trim < best.trim) best = { edit: r.edit, trim, station };
  }
  if (best === null)
    return {
      ok: false,
      reason: `No station takes ${entry.displayName} without a new blocking problem.`,
    };
  return { ok: true, edit: best.edit, stationPermille: best.station };
}
