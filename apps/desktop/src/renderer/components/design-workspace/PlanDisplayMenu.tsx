import { ChevronDown, Eye } from "lucide-react";
import { Button } from "../ui/button.js";
import { Checkbox } from "../ui/checkbox.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Separator } from "../ui/separator.js";
import { FindingsViewOptions, type FindingsView } from "./validation/FindingsControl.js";

/**
 * What the plan drawing shows (gun arcs, findings and their severities), behind one toolbar button: view preferences,
 * never design state, so they stay out of the way until asked for.
 */
export function PlanDisplayMenu({
  showArcs,
  onShowArcs,
  findingsView,
  onFindingsView,
}: {
  readonly showArcs: boolean;
  readonly onShowArcs: (next: boolean) => void;
  readonly findingsView: FindingsView;
  readonly onFindingsView: (next: FindingsView) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" aria-label="Plan display" />}>
        <Eye aria-hidden="true" />
        View
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Plan display" className="w-64 space-y-3 text-sm">
        <div className="font-medium">Show on the plan</div>
        <div className="flex items-center gap-2">
          <Checkbox
            aria-label="Show gun arcs"
            checked={showArcs}
            onCheckedChange={(v) => onShowArcs(v === true)}
          />
          <span aria-hidden="true">Show gun arcs</span>
        </div>
        <Separator />
        <FindingsViewOptions
          className="flex-col items-stretch gap-2"
          view={findingsView}
          onChange={onFindingsView}
        />
      </PopoverContent>
    </Popover>
  );
}
