import { Badge } from "../../../components/ui/badge.js";
import { Tip } from "../../../components/ui/tip.js";

export interface DesignStatus {
  readonly label: string;
  readonly tone: "ok" | "warn" | "bad";
  readonly detail: string;
}

export function DesignStatusChip({
  status,
  onAction,
}: {
  readonly status: DesignStatus;
  readonly onAction?: () => void;
}) {
  const badge = (
    <Tip label={status.detail}>
      <Badge
        role={onAction === undefined ? "status" : undefined}
        variant={
          status.tone === "ok" ? "secondary" : status.tone === "warn" ? "outline" : "destructive"
        }
      >
        <span className="sr-only">Design status: </span>
        {status.label}
        <span className="sr-only">, {status.detail}</span>
      </Badge>
    </Tip>
  );
  if (onAction === undefined) return badge;
  return (
    <div role="status">
      <Tip label={`${status.label}: click to fix`}>
        <button
          type="button"
          onClick={onAction}
          aria-label={`${status.label}, ${status.detail}. Activate to fix`}
          className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {badge}
        </button>
      </Tip>
    </div>
  );
}
