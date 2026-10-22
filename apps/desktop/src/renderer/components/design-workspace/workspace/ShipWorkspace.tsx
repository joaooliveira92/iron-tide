import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../ui/button.js";
import { SplitDivider } from "./SplitDivider.js";
import { TAB_PANE_MIN, useSplitWidth } from "./useSplitWidth.js";

export function ShipWorkspace({
  ship,
  children,
}: {
  readonly ship: ReactNode;
  readonly children: ReactNode;
}) {
  const shipId = useId();
  const [split, setSplit] = useSplitWidth();
  const [shipOpen, setShipOpen] = useState(true);
  return (
    <div
      data-testid="ship-workspace"
      className="min-h-0 flex-1 space-y-4 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,min(var(--ship-pane),calc(100%_-_var(--tab-pane-min)_-_1.25rem)))_0.75rem_minmax(0,1fr)] lg:gap-1 lg:space-y-0 lg:overflow-hidden"
      style={{ "--ship-pane": `${split}%`, "--tab-pane-min": TAB_PANE_MIN } as CSSProperties}
    >
      <section
        aria-label="Ship view"
        className="themed-scrollbar space-y-2 lg:min-h-0 lg:overflow-y-auto lg:pr-1"
      >
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between lg:hidden"
          aria-expanded={shipOpen}
          aria-controls={shipId}
          onClick={() => setShipOpen((open) => !open)}
        >
          {shipOpen ? "Hide ship view" : "Show ship view"}
          {shipOpen ? (
            <ChevronUp aria-hidden="true" className="size-4" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )}
        </Button>
        <div
          id={shipId}
          data-testid="ship-view"
          className={shipOpen ? undefined : "hidden lg:block"}
        >
          {ship}
        </div>
      </section>
      <SplitDivider
        value={split}
        onChange={setSplit}
        controls={shipId}
        className="hidden lg:flex"
      />
      <div data-testid="tab-pane" className="@container lg:min-h-0 lg:overflow-y-auto lg:pl-1">
        {children}
      </div>
    </div>
  );
}
