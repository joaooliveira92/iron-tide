import type { MonthlyReportFleet } from "../../../../shared/reports-contract.js";

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
