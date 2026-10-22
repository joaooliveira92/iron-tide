import type { ReactNode } from "react";

export interface ShipStageProps {
  readonly toolbar?: ReactNode;
  readonly children: ReactNode;
}

export function ShipStage({ toolbar, children }: ShipStageProps) {
  return (
    <section aria-label="Ship view" className="flex h-full min-h-0 min-w-0 flex-col">
      {toolbar !== undefined && (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">{toolbar}</div>
      )}
      <div className="themed-scrollbar min-h-0 flex-1 overflow-auto p-3" data-selection-scope="">
        {children}
      </div>
    </section>
  );
}
