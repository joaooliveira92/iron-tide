import type { ReactNode } from "react";
import type { RebuildCheckView } from "../../../../../shared/design-contract.js";
import { Badge } from "../../../ui/badge.js";

export function RebuildCheckReport({
  check,
  children,
}: {
  readonly check: RebuildCheckView;
  readonly children: ReactNode;
}) {
  return (
    <div role="status" className="space-y-2 text-sm">
      <p className="font-medium">
        <Badge variant={check.legal ? "secondary" : "destructive"}>
          {check.legal ? "Rebuild allowed" : "Rebuild not allowed"}
        </Badge>
        {check.changesNothing && (
          <span className="ml-2 font-normal text-muted-foreground">
            The design is the same as the ship&apos;s: change something first.
          </span>
        )}
      </p>
      {children}
    </div>
  );
}
