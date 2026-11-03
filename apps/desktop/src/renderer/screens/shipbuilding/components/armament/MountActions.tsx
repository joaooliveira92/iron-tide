import { Button } from "../../../../components/ui/button.js";
import { oppositeSide } from "../../armament.js";
import { useArmamentActions, useArmamentEditing } from "./ArmamentEditing.js";

export function MountActions() {
  const { selected } = useArmamentEditing();
  const { duplicate, duplicateSymmetrically, mirrorSide, remove } = useArmamentActions();
  if (selected === null) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t pt-3">
      <Button variant="outline" size="sm" onClick={() => duplicate(selected)}>
        Duplicate
      </Button>
      <Button variant="outline" size="sm" onClick={() => duplicateSymmetrically(selected)}>
        Duplicate to opposite side
      </Button>
      {selected.side !== "CENTRE" && (
        <Button variant="outline" size="sm" onClick={() => mirrorSide(selected)}>
          Mirror to {oppositeSide(selected.side) === "PORT" ? "port" : "starboard"}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => remove(selected)}>
        Remove
      </Button>
    </div>
  );
}
