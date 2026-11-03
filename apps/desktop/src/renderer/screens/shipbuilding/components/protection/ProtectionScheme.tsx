import { Checkbox } from "../../../../components/ui/checkbox.js";
import { newArmourRegion } from "@bluewave/ship-design";
import { ArmourSchemeSelector } from "../ArmourSchemeSelector.js";
import { useProtectionActions, useProtectionEditing } from "./ProtectionEditing.js";

export function ProtectionScheme() {
  const { model } = useProtectionEditing();
  const { edit } = useProtectionActions();
  return (
    <>
      <ArmourSchemeSelector model={model} edit={edit} />
      <MagazineBoxToggle />
    </>
  );
}

function MagazineBoxToggle() {
  const { model } = useProtectionEditing();
  const { edit } = useProtectionActions();
  const fitted = model.fitted.some((field) => field.region === "MAGAZINE_BOX");
  const canAdd = model.defaultMaterialId !== "";
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        aria-label="Magazine box"
        checked={fitted}
        disabled={!fitted && !canAdd}
        onCheckedChange={(on) =>
          edit(
            on === true
              ? {
                  kind: "set_armour_region",
                  region: newArmourRegion(
                    "MAGAZINE_BOX",
                    model.regionSizing,
                    model.defaultMaterialId,
                  ),
                }
              : { kind: "remove_armour_region", region: "MAGAZINE_BOX" },
          )
        }
      />
      <span aria-hidden="true">Magazine box</span>
      <span className="text-xs text-muted-foreground">
        Armoured box round the magazines; adjust it below.
      </span>
    </label>
  );
}
