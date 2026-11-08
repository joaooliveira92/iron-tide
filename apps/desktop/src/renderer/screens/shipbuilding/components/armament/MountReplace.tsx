import { Button } from "../../../../components/ui/button.js";
import { SelectField } from "../../../../components/design-workspace/fields.js";
import { PickerFilterControls } from "../../../../components/design-workspace/PickerFilterControls.js";
import { useArmamentActions, useArmamentEditing } from "./ArmamentEditing.js";

export function MountReplace() {
  const { selected, replaceCandidates, replacePool, pickerFilters, replaceTo } =
    useArmamentEditing();
  const { setReplaceTo, replace, setPickerFilters } = useArmamentActions();
  if (selected === null || replacePool.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <PickerFilterControls
        catalogue={replacePool}
        filters={pickerFilters}
        onChange={setPickerFilters}
      />
      <div className="flex items-end gap-2">
        <SelectField
          className="flex-1"
          label={`Replace ${selected.instanceId} with`}
          shortLabel="Replace with"
          value={replaceTo}
          options={replaceCandidates.map((candidate) => ({
            value: candidate.id,
            label: candidate.displayName,
          }))}
          onChange={setReplaceTo}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={replaceTo === ""}
          onClick={() => {
            replace(selected, replaceTo);
            setReplaceTo("");
          }}
        >
          Replace
        </Button>
      </div>
    </div>
  );
}
