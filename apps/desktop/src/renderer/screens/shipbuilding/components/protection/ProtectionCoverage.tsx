import { Badge } from "../../../../components/ui/badge.js";
import { useProtectionEditing, useProtectionMeta } from "./ProtectionEditing.js";

export function ProtectionCoverage() {
  const { model } = useProtectionEditing();
  const { format } = useProtectionMeta();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Belt coverage</span>
      <Badge variant="outline" className="tabular-nums">
        {format.percent(model.coverageBp, 0)}
      </Badge>
      <span className="text-muted-foreground">Armour weight</span>
      <Badge variant="outline" className="tabular-nums">
        {format.measurement(model.totalWeightKg, "mass", { maximumFractionDigits: 0 })}
      </Badge>
    </div>
  );
}
