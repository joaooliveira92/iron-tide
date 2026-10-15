import type { MonthlyReportFleet } from "../../../../shared/campaign-command-contract.js";

/**
 * The report's Fleet section (spec §16): the month's additions and the active
 * ship total from the post-month snapshot. The per-ship "new maintenance
 * effect" is CUT — only the aggregate maintenance figure is modelled.
 */
export function MonthReportFleetSection({ fleet }: { readonly fleet: MonthlyReportFleet }) {
  return (
    <section aria-label="Fleet" className="space-y-1">
      <p className="font-medium">Fleet</p>
      <p className="text-muted-foreground">
        {fleet.totalActiveShips} active {fleet.totalActiveShips === 1 ? "ship" : "ships"} ·{" "}
        {fleet.additions.length} added this month
      </p>
      {fleet.additions.length > 0 && (
        <p className="text-muted-foreground">
          Commissioned: {fleet.additions.map((ship) => ship.name).join(", ")}
        </p>
      )}
    </section>
  );
}
