import { ZONE_IDS, type MountSide, type ZoneId } from "@bluewave/ship-design";
import { Checkbox } from "../../../../components/ui/checkbox.js";
import { NumberField, SelectField } from "../../../../components/design-workspace/fields.js";
import { useArmamentActions, useArmamentEditing } from "./ArmamentEditing.js";

const zoneLabel = (zone: string) => zone.replaceAll("_", " ").toLowerCase();

const isMountSide = (value: string): value is MountSide =>
  value === "CENTRE" || value === "PORT" || value === "STBD";

const SIDE_OPTIONS = [
  { value: "CENTRE", label: "Centreline" },
  { value: "PORT", label: "Port" },
  { value: "STBD", label: "Starboard" },
] as const;

export function MountFields() {
  const { selected, entry, linked, mirror } = useArmamentEditing();
  const { setNumber, setStation, setSide, moveZone, setLinked } = useArmamentActions();
  if (selected === null) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={`Barrel count of ${selected.instanceId}`}
          shortLabel="Barrel count"
          value={selected.barrels}
          min={entry?.parameters?.barrels?.min}
          max={entry?.parameters?.barrels?.max}
          step={entry?.parameters?.barrels?.step}
          onCommit={(value) => setNumber(selected, "barrels", value)}
        />
        {selected.rounds !== null && (
          <NumberField
            label={`Ammunition per gun of ${selected.instanceId}`}
            shortLabel="Ammunition per gun"
            unit="rounds"
            value={selected.rounds}
            min={entry?.parameters?.rounds?.min}
            max={entry?.parameters?.rounds?.max}
            step={entry?.parameters?.rounds?.step}
            onCommit={(value) => setNumber(selected, "rounds", value)}
          />
        )}
        <SelectField
          label={`Mount position of ${selected.instanceId}`}
          shortLabel="Zone"
          value={selected.zoneId}
          options={ZONE_IDS.map((zone) => ({ value: zone, label: zoneLabel(zone) }))}
          onChange={(value) => moveZone(selected, value as ZoneId)}
        />
        <NumberField
          label={`Station of ${selected.instanceId}`}
          shortLabel="Station"
          unit="‰"
          value={selected.stationPermille}
          min={0}
          max={1000}
          onCommit={(value) => setStation(selected, value)}
        />
        <SelectField
          label={`Side of ${selected.instanceId}`}
          shortLabel="Side"
          value={selected.side}
          options={[...SIDE_OPTIONS]}
          onChange={(value) => {
            if (isMountSide(value)) setSide(selected, value);
          }}
        />
      </div>

      {(selected.side === "PORT" || selected.side === "STBD") && mirror !== null && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            aria-label="Link port and starboard mounts"
            checked={linked}
            onCheckedChange={(value) => setLinked(value === true)}
          />
          Link port and starboard mounts: barrel count, ammunition and station edits apply to{" "}
          {mirror.name} too
        </label>
      )}
    </>
  );
}
