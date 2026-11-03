import { Badge } from "../../../../components/ui/badge.js";
import { SEVERITY_STYLE } from "../../../../components/design-workspace/validation/severity.js";
import { useArmamentEditing } from "./ArmamentEditing.js";

export function MountConflicts() {
  const { conflicts } = useArmamentEditing();
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">Placement conflicts ({conflicts.length})</div>
      {conflicts.length === 0 ? (
        <p className="text-sm text-muted-foreground">None for this mount.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {conflicts.map((finding) => (
            <li key={finding.key} className="flex items-start gap-2">
              <Badge variant={SEVERITY_STYLE[finding.severity].badge}>{finding.severity}</Badge>
              <span>{finding.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
