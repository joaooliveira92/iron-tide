import type { AntiAircraftFit, DraftEdit } from "@bluewave/ship-design";
import { NumberField } from "../../../components/design-workspace/fields.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import type { AntiAircraftModel } from "../anti-aircraft-view.js";

/**
 * Light and medium AA guns and AA directors (manual p.43) as counts. Setting every count to zero removes the fit. The
 * readout states what the compile decided.
 */
export function AntiAircraftPanel({
  model,
  edit,
}: {
  readonly model: AntiAircraftModel;
  readonly edit: (e: DraftEdit) => void;
}) {
  const set = (change: Partial<AntiAircraftFit>) =>
    edit({ kind: "set_anti_aircraft", antiAircraft: { ...model.fit, ...change } });
  return (
    <Panel title="Anti-aircraft">
      <div className="flex flex-wrap gap-3">
        <NumberField
          className="w-32"
          label="Light AA guns"
          min={0}
          max={1000}
          value={model.fit.lightGuns}
          onCommit={(v) => set({ lightGuns: v })}
        />
        <NumberField
          className="w-32"
          label="Medium AA guns"
          min={0}
          max={1000}
          value={model.fit.mediumGuns}
          onCommit={(v) => set({ mediumGuns: v })}
        />
        <NumberField
          className="w-32"
          label="AA directors"
          min={0}
          max={model.maxDirectors}
          value={model.fit.directors}
          onCommit={(v) => set({ directors: v })}
        />
      </div>
      <p className="text-sm text-muted-foreground" data-anti-aircraft-status={model.status}>
        {model.text}
      </p>
    </Panel>
  );
}
