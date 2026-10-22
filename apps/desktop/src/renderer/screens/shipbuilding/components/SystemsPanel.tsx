import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Checkbox } from "../../../components/ui/checkbox.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import type { SystemGroup } from "../systems-view.js";

export function SystemsPanel({
  groups,
  showUnavailable,
  onShowUnavailable,
  onAdd,
}: {
  readonly groups: readonly SystemGroup[];
  readonly showUnavailable: boolean;
  readonly onShowUnavailable: (show: boolean) => void;
  readonly onAdd: (componentId: string) => void;
}) {
  return (
    <Panel title="Systems">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={showUnavailable}
          onCheckedChange={(v) => onShowUnavailable(v === true)}
        />
        Show unavailable technology
      </label>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not available yet: nothing of this kind can be fitted to this design.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.category} aria-label={g.label} className="space-y-1.5">
              <h3 className="text-sm font-medium">{g.label}</h3>
              <ul className="space-y-1">
                {g.items.map((i) => (
                  <li
                    key={i.componentId}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm"
                    data-system={i.componentId}
                    data-available={i.available}
                  >
                    <span className={i.available ? undefined : "text-muted-foreground"}>
                      {i.name}
                      {i.fitted > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {i.fitted} fitted
                        </Badge>
                      )}
                    </span>
                    {i.available ? (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Add ${i.name}`}
                        onClick={() => onAdd(i.componentId)}
                      >
                        Add
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{i.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}
