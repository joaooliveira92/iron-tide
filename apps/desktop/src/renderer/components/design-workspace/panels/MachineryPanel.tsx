import type { DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../content.js";
import { NumberField, SelectField } from "../fields.js";
import { Panel } from "./Panel.js";
import type { Edit } from "./types.js";
import { plural } from "../plural.js";
import { enginePriorityTrade } from "./engine-priority.js";

export function MachineryPanel({
  draft,
  content,
  edit,
}: {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly edit: Edit;
}) {
  const m = draft.machinery;
  return (
    <Panel title="Machinery, fuel and range">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SelectField
          label="Plant"
          value={m.plantId}
          options={content.plants.map((p) => ({ value: p.id, label: p.id.replaceAll("_", " ") }))}
          onChange={(v) => edit({ kind: "set_machinery", patch: { plantId: v } })}
        />
        <NumberField
          label="Installed power"
          unit="kW"
          value={m.installedKw}
          onCommit={(v) => edit({ kind: "set_machinery", patch: { installedKw: v } })}
        />
        <NumberField
          label="Coal bunkers"
          unit="t"
          value={m.fuelCapacityKg}
          scale={1000}
          onCommit={(v) => edit({ kind: "set_machinery", patch: { fuelCapacityKg: v } })}
        />
        <NumberField
          label="Engine priority — Reliability ←→ Speed"
          shortLabel="Engine priority"
          unit="% (− reliability, + speed)"
          value={m.enginePriorityBp ?? 0}
          scale={100}
          min={-100}
          max={100}
          onCommit={(v) => edit({ kind: "set_machinery", patch: { enginePriorityBp: v } })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {enginePriorityTrade(m.enginePriorityBp ?? 0)}
      </p>
      <p className="text-xs text-muted-foreground">
        {plural(m.rooms?.length ?? 1, "machinery room")}. Cruise speed and range target come from
        the requirement: {(draft.requirement.cruiseSpeedMilliKnots / 1000).toFixed(1)} kn,{" "}
        {draft.requirement.requiredRangeNm.toLocaleString("en-US")} nm.
      </p>
    </Panel>
  );
}
