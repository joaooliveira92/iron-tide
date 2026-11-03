import type { MovementCommand } from "@bluewave/campaign-engine";
import { RefreshCw } from "lucide-react";
import { memo } from "react";
import { SlipButton } from "../../../components/slate/DispatchSlip.js";

export interface OrderActionsProps {
  readonly busy: boolean;
  readonly canSubmit: boolean;
  readonly canReplace: boolean;
  readonly pendingRoute: MovementCommand | null;
  readonly hasPendingRequest: boolean;
  readonly onSubmit: () => void;
  readonly onReplace: (commandId: string) => void;
  readonly onCancel: (commandId: string) => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
}

export const OrderActions = memo(function OrderActions({
  busy,
  canSubmit,
  canReplace,
  pendingRoute,
  hasPendingRequest,
  onSubmit,
  onReplace,
  onCancel,
  onRefresh,
  onRetry,
}: OrderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SlipButton tone="primary" onClick={onSubmit} disabled={busy || !canSubmit}>
        Submit movement command
      </SlipButton>
      {pendingRoute !== null && (
        <>
          <SlipButton
            tone="quiet"
            onClick={() => onReplace(pendingRoute.commandId)}
            disabled={busy || !canReplace}
          >
            Replace pending route
          </SlipButton>
          <SlipButton tone="quiet" onClick={() => onCancel(pendingRoute.commandId)} disabled={busy}>
            Cancel pending route
          </SlipButton>
        </>
      )}
      {hasPendingRequest && (
        <SlipButton tone="quiet" onClick={onRetry}>
          Retry pending request
        </SlipButton>
      )}
      <SlipButton
        tone="quiet"
        aria-label="Refresh"
        title="Refresh"
        onClick={onRefresh}
        className="p-1.5 no-underline"
      >
        <RefreshCw aria-hidden="true" className="size-4" />
      </SlipButton>
    </div>
  );
});
