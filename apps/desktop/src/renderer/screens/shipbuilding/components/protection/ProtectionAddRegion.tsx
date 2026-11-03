import { Button } from "../../../../components/ui/button.js";
import { SelectField } from "../../../../components/design-workspace/fields.js";
import { useProtectionActions, useProtectionEditing } from "./ProtectionEditing.js";

export function ProtectionAddRegion() {
  const { model, toAdd } = useProtectionEditing();
  const { setToAdd, add } = useProtectionActions();
  if (model.availableRegions.length === 0) return null;
  return (
    <div className="flex items-end gap-2">
      <SelectField
        className="flex-1"
        label="Add armour region"
        value={toAdd === "" ? (model.availableRegions[0]?.id ?? "") : toAdd}
        options={model.availableRegions.map((region) => ({
          value: region.id,
          label: region.label,
        }))}
        onChange={setToAdd}
      />
      <Button variant="outline" size="sm" onClick={add}>
        Add region
      </Button>
    </div>
  );
}
