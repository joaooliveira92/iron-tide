import type { PlacementSpec } from "@bluewave/ship-design";
import { SelectField } from "../../fields.js";
import type { PlacementActions } from "./usePlacementsState.js";
import { isMountSide } from "./placement-helpers.js";

export function PlacementSideField({
  placement,
  actions,
}: {
  readonly placement: PlacementSpec;
  readonly actions: Pick<PlacementActions, "setSide">;
}) {
  return (
    <SelectField
      className="w-36"
      label={`Side of ${placement.instanceId}`}
      shortLabel="Side"
      value={placement.side ?? "CENTRE"}
      options={[
        { value: "CENTRE", label: "Centreline" },
        { value: "PORT", label: "Port" },
        { value: "STBD", label: "Starboard" },
      ]}
      onChange={(v) => {
        if (isMountSide(v)) actions.setSide(placement, v);
      }}
    />
  );
}
