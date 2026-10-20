import type { DraftEdit } from "@bluewave/ship-design";
import { Checkbox } from "../../../components/ui/checkbox.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import type { ColonialServiceModel } from "../colonial-service-view.js";

/**
 * Colonial service (manual p.42): the fitting trades displacement for the stores and marine contingent a foreign
 * station needs, and earns the `c` marker on the ship list. The readout states what the compile decided.
 */
export function ColonialServicePanel({
  model,
  edit,
}: {
  readonly model: ColonialServiceModel;
  readonly edit: (e: DraftEdit) => void;
}) {
  return (
    <Panel title="Colonial service">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={model.fitted}
          aria-label="Fit for colonial service"
          onCheckedChange={(v) => edit({ kind: "set_colonial_service", fitted: v === true })}
        />
        Fit for colonial service
      </label>
      <p className="text-sm text-muted-foreground" data-colonial-status={model.status}>
        {model.text}
      </p>
    </Panel>
  );
}
