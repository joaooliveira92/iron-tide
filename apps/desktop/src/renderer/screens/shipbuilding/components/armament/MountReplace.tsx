import { Button } from "../../../../components/ui/button.js";
import { SelectField } from "../../../../components/design-workspace/fields.js";
import { useArmamentActions, useArmamentEditing } from "./ArmamentEditing.js";

export function MountReplace() {
  const { selected, replaceCandidates, replaceTo, month } = useArmamentEditing();
  const { setReplaceTo, replace } = useArmamentActions();
  if (selected === null || replaceCandidates.length === 0) return null;
  return (
    <div className="flex items-end gap-2">
      <SelectField
        className="flex-1"
        label={`Replace ${selected.instanceId} with`}
        shortLabel="Replace with"
        value={replaceTo}
        options={replaceCandidates.map((candidate) => ({
          value: candidate.id,
          label: candidate.displayName,
          disabled: candidate.introduction.fromMonth > month,
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
  );
}
