import type { MovementCommand } from "@bluewave/campaign-engine";
import { memo } from "react";
import { Button } from "../../../components/ui/button.js";

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
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="default" onClick={onSubmit} disabled={busy || !canSubmit}>
        Submit movement command
      </Button>
      {pendingRoute !== null && (
        <>
          <Button
            variant="outline"
            onClick={() => onReplace(pendingRoute.commandId)}
            disabled={busy || !canReplace}
          >
            Replace pending route
          </Button>
          <Button
            variant="outline"
            onClick={() => onCancel(pendingRoute.commandId)}
            disabled={busy}
          >
            Cancel pending route
          </Button>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={onRefresh}>
        Refresh
      </Button>
      {hasPendingRequest && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry pending request
        </Button>
      )}
    </div>
  );
});
