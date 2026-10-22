import type { LucideIcon } from "lucide-react";
import { Ban, CheckCircle2, Clock, RefreshCwOff } from "lucide-react";
import type { ConstructionCommandStatus } from "@bluewave/campaign-engine";
import { Badge } from "../../../components/ui/badge.js";

const STATUS_ICON: Record<ConstructionCommandStatus, LucideIcon> = {
  submitted: Clock,
  accepted: CheckCircle2,
  superseded: RefreshCwOff,
  cancelled: Ban,
};

const STATUS_CLASSNAME: Record<ConstructionCommandStatus, string> = {
  submitted: "border-transparent bg-warning/15 text-warning",
  accepted: "border-transparent bg-success/15 text-success",
  superseded: "border-transparent bg-secondary text-secondary-foreground",
  cancelled: "text-muted-foreground",
};

export interface CommandStatusBadgeProps {
  readonly status: ConstructionCommandStatus;
}

export function CommandStatusBadge({ status }: CommandStatusBadgeProps) {
  const StatusIcon = STATUS_ICON[status];
  return (
    <Badge className={`gap-1 text-xs uppercase ${STATUS_CLASSNAME[status]}`}>
      <StatusIcon className="h-3 w-3" />
      {status}
    </Badge>
  );
}
