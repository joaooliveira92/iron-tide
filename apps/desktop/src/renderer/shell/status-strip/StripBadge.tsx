import { CircleAlert, CircleCheck } from "lucide-react";

import { Badge } from "../../components/ui/badge.js";
import { cn } from "../../lib/utils.js";
import type { StripTone } from "../status-strip-state.js";

export function StripBadge({
  status,
  tone,
}: {
  readonly status: string;
  readonly tone: StripTone;
}) {
  const Icon = tone === "alert" ? CircleAlert : CircleCheck;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-1.5 py-0 text-xs font-semibold uppercase tracking-wide text-foreground",
        tone === "alert"
          ? "border-destructive/40 bg-destructive/10"
          : "border-success/40 bg-success/10",
      )}
    >
      <Icon
        className={cn("size-3", tone === "alert" ? "text-destructive" : "text-success")}
        aria-hidden="true"
      />
      {status}
    </Badge>
  );
}
