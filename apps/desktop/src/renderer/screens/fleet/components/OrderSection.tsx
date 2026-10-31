import type { MovementCommand } from "@bluewave/campaign-engine";
import { memo } from "react";
import type { FleetScreenProjection } from "../../../../shared/fleet-contract.js";
import { DispatchSlip } from "../../../components/slate/DispatchSlip.js";
import type { OrderStatusView } from "../fleet-screen-state.js";
import { DestinationPicker } from "./DestinationPicker.js";
import { OrderActions } from "./OrderActions.js";
import { OrderNotice } from "./OrderNotice.js";
import { OrderStatusSummary } from "./OrderStatusSummary.js";

export interface OrderSectionOrder {
  readonly status: OrderStatusView;
  readonly pendingRoute: MovementCommand | null;
}

export interface OrderSectionActions {
  readonly busy: boolean;
  readonly hasPendingRequest: boolean;
  readonly onSubmit: () => void;
  readonly onReplace: (commandId: string) => void;
  readonly onCancel: (commandId: string) => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
}

export interface OrderSectionProps {
  readonly destinations: FleetScreenProjection["areas"];
  readonly destinationAreaId: string | null;
  readonly onDestinationChange: (areaId: string) => void;
  readonly order: OrderSectionOrder;
  readonly actions: OrderSectionActions;
  readonly notice: string | null;
}

export const OrderSection = memo(function OrderSection({
  destinations,
  destinationAreaId,
  onDestinationChange,
  order,
  actions,
  notice,
}: OrderSectionProps) {
  return (
    <DispatchSlip label="Fleet dispatch" sealed={order.pendingRoute !== null} testId="fleet-order">
      <OrderStatusSummary status={order.status} />
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <DestinationPicker
          areas={destinations}
          value={destinationAreaId}
          onChange={onDestinationChange}
        />
        <OrderActions
          busy={actions.busy}
          canSubmit={order.status.divisionName !== null && destinationAreaId !== null}
          canReplace={destinationAreaId !== null}
          pendingRoute={order.pendingRoute}
          hasPendingRequest={actions.hasPendingRequest}
          onSubmit={actions.onSubmit}
          onReplace={actions.onReplace}
          onCancel={actions.onCancel}
          onRefresh={actions.onRefresh}
          onRetry={actions.onRetry}
        />
      </div>
      <OrderNotice notice={notice} />
    </DispatchSlip>
  );
});
