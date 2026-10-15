import { memo } from "react";
import type { OrderStatusView } from "../fleet-screen-state.js";

export interface OrderStatusSummaryProps {
  readonly status: OrderStatusView;
}

export const OrderStatusSummary = memo(function OrderStatusSummary({
  status,
}: OrderStatusSummaryProps) {
  return (
    <p className="text-sm text-muted-foreground">
      {status.divisionName === null ? (
        "Select a division."
      ) : status.routeFromName === null ? (
        <>
          <strong>{status.divisionName}</strong> is in {status.locationName} with no pending route.
        </>
      ) : (
        <>
          <strong>{status.divisionName}</strong> has a pending route{" "}
          <strong>{status.routeFromName}</strong> → <strong>{status.routeToName}</strong>.
        </>
      )}
    </p>
  );
});
