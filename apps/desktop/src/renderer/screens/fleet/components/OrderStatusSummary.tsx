import { memo } from "react";
import { SealedLine } from "../../../components/slate/DispatchSlip.js";
import type { OrderStatusView } from "../fleet-screen-state.js";

export interface OrderStatusSummaryProps {
  readonly status: OrderStatusView;
}

export const OrderStatusSummary = memo(function OrderStatusSummary({
  status,
}: OrderStatusSummaryProps) {
  if (status.divisionName === null) {
    return <p className="text-sm text-admiralty-ink-muted">Select a division.</p>;
  }
  if (status.routeFromName === null) {
    return (
      <p className="text-sm leading-snug text-admiralty-ink-muted">
        <strong className="font-display text-base font-semibold text-admiralty-ink">
          {status.divisionName}
        </strong>{" "}
        is in {status.locationName} with no pending route.
      </p>
    );
  }
  return (
    <SealedLine key={`${status.routeFromName}:${status.routeToName}`}>
      <strong className="font-display text-base font-semibold">{status.divisionName}</strong> has a
      pending route <strong>{status.routeFromName}</strong> → <strong>{status.routeToName}</strong>.
    </SealedLine>
  );
});
