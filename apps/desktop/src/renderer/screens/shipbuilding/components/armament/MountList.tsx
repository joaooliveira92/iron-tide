import { Badge } from "../../../../components/ui/badge.js";
import { Button } from "../../../../components/ui/button.js";
import { batterySymmetry } from "../../../../components/design-workspace/batteryView.js";
import { plural } from "../../../../components/design-workspace/plural.js";
import { shipLinkAttrs } from "../../../../components/design-workspace/selection/navigation.js";
import { useArmamentActions, useArmamentEditing, useArmamentMeta } from "./ArmamentEditing.js";

export function ArmamentMounts() {
  const { entries, mounts, activeId } = useArmamentEditing();
  const { select } = useArmamentActions();
  const { format } = useArmamentMeta();
  if (mounts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No guns or torpedo tubes are fitted here. Use Add component below, or right-click the ship
        plan and choose Place.
      </p>
    );
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry.row.key} className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {entry.title}
              {batterySymmetry(entry) === "asymmetric" && (
                <Badge variant="secondary" className="ml-2" title="Port and starboard differ">
                  Asymmetric
                </Badge>
              )}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {plural(entry.mounts.length, "mount")} ·{" "}
              {format.measurement(entry.row.weightKg, "mass", { maximumFractionDigits: 1 })}
            </span>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label={`${entry.title} mounts`}>
            {entry.mounts.map((mount) => (
              <li key={mount.instanceId}>
                <Button
                  type="button"
                  size="sm"
                  variant={activeId === mount.instanceId ? "default" : "outline"}
                  aria-pressed={activeId === mount.instanceId}
                  aria-label={`Select mount ${mount.layout}`}
                  className="tabular-nums"
                  onClick={() => select(mount)}
                  {...shipLinkAttrs([{ kind: "fitting", instanceId: mount.instanceId }])}
                >
                  {mount.layout}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
