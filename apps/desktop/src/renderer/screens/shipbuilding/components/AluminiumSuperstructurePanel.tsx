import type { DraftEdit } from "@bluewave/ship-design";
import { Checkbox } from "../../../components/ui/checkbox.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import type { AluminiumModel } from "../aluminium-view.js";

/**
 * Aluminium superstructure (manual p.45): a lighter hull for a higher fire risk, offered once the ruleset makes it
 * available. The readout states what the compile decided.
 */
export function AluminiumSuperstructurePanel({
  model,
  edit,
}: {
  readonly model: AluminiumModel;
  readonly edit: (e: DraftEdit) => void;
}) {
  return (
    <Panel title="Superstructure">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={model.fitted}
          aria-label="Aluminium superstructure"
          onCheckedChange={(v) =>
            edit({ kind: "set_aluminium_superstructure", fitted: v === true })
          }
        />
        Aluminium superstructure
      </label>
      <p className="text-sm text-muted-foreground" data-aluminium-status={model.status}>
        {model.text}
      </p>
    </Panel>
  );
}
