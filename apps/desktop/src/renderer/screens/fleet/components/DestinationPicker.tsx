import { memo, useId } from "react";
import type { FleetScreenProjection } from "../../../../shared/fleet-contract.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.js";

export interface DestinationPickerProps {
  readonly areas: FleetScreenProjection["areas"];
  readonly value: string | null;
  readonly onChange: (areaId: string) => void;
}

export const DestinationPicker = memo(function DestinationPicker({
  areas,
  value,
  onChange,
}: DestinationPickerProps) {
  const destinationId = useId();
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium" htmlFor={destinationId}>
        Destination
      </label>
      <Select value={value ?? ""} onValueChange={onChange} className="w-full">
        <SelectTrigger id={destinationId}>
          <SelectValue placeholder="Select a destination" />
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.id} value={area.id}>
              {area.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});
