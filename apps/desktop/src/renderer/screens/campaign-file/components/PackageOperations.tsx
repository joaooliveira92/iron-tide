import { Play, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import type { OperationKind } from "../types.js";

interface PackageOperationsProps {
  readonly pendingOperation: OperationKind | null;
  readonly onRun: (kind: OperationKind) => void;
}

export function PackageOperations({ pendingOperation, onRun }: PackageOperationsProps) {
  const disabled = pendingOperation !== null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Package Operations
      </h2>
      <div className="grid grid-cols-3 gap-4">
        <Button
          variant="secondary"
          className="flex-col gap-1 h-16"
          onClick={() => onRun("verify")}
          disabled={disabled}
        >
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs">Verify</span>
        </Button>
        <Button
          variant="secondary"
          className="flex-col gap-1 h-16"
          onClick={() => onRun("recover")}
          disabled={disabled}
        >
          <RefreshCw className="h-5 w-5" />
          <span className="text-xs">Recover</span>
        </Button>
        <Button
          variant="secondary"
          className="flex-col gap-1 h-16"
          onClick={() => onRun("replay")}
          disabled={disabled}
        >
          <Play className="h-5 w-5" />
          <span className="text-xs">Replay</span>
        </Button>
      </div>
    </div>
  );
}
