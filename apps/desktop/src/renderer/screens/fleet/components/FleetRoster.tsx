import { Keyboard } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Slate, SlateTitle } from "../../../components/slate/Slate.js";

export interface FleetRosterProps {
  readonly divisionCount: number;
  readonly children: ReactNode;
  readonly hint: ReactNode;
}

export function FleetRoster({ divisionCount, children, hint }: FleetRosterProps) {
  const [showKeys, setShowKeys] = useState(false);
  return (
    <Slate aria-label="Divisions" data-testid="fleet-station-board" className="w-full">
      <header className="flex items-center gap-2 border-b border-admiralty-border px-4 py-2.5">
        <SlateTitle>Divisions</SlateTitle>
        <span className="text-sm tabular-nums text-admiralty-ink-muted">{divisionCount}</span>
        <button
          type="button"
          aria-label="Keyboard shortcuts"
          aria-expanded={showKeys}
          onClick={() => setShowKeys(!showKeys)}
          className="ml-auto rounded-sm p-1.5 text-admiralty-ink-muted hover:bg-admiralty-surface hover:text-admiralty-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal"
        >
          <Keyboard aria-hidden="true" className="size-4" />
        </button>
      </header>
      <p
        hidden={!showKeys}
        data-testid="fleet-hotkey-hint"
        className="border-b border-admiralty-border bg-admiralty-surface px-4 py-2 text-[0.8125rem] leading-snug text-admiralty-ink-muted"
      >
        {hint}
      </p>
      <div
        data-testid="fleet-divisions"
        className="themed-scrollbar max-h-[clamp(9rem,calc(100svh-26rem),22rem)] overflow-y-auto"
      >
        {children}
      </div>
    </Slate>
  );
}
