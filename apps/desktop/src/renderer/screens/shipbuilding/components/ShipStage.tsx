import type { CSSProperties, ReactNode } from "react";

export interface ShipStageProps {
  readonly toolbar?: ReactNode;
  readonly children: ReactNode;
}

const TABLE: CSSProperties = {
  backgroundImage: [
    "linear-gradient(color-mix(in srgb, var(--color-admiralty-border) 55%, transparent) 1px, transparent 1px)",
    "linear-gradient(90deg, color-mix(in srgb, var(--color-admiralty-border) 55%, transparent) 1px, transparent 1px)",
  ].join(", "),
  backgroundSize: "2rem 2rem",
};

export function ShipStage({ toolbar, children }: ShipStageProps) {
  return (
    <section
      aria-label="Ship view"
      className="absolute inset-0 overflow-hidden bg-admiralty-surface text-admiralty-ink"
      style={TABLE}
    >
      {toolbar !== undefined && (
        <div className="absolute left-3 top-[calc(var(--chrome-top,0px)+0.75rem)] z-10">
          {toolbar}
        </div>
      )}
      <div
        className="themed-scrollbar absolute inset-0 overflow-auto pb-[calc(var(--chrome-bottom,0px)+var(--chrome-slip,0px)+1rem)] pl-6 pr-[var(--chrome-right,1.5rem)] pt-[calc(var(--chrome-top,0px)+4.5rem)]"
        data-selection-scope=""
      >
        <div className="mx-auto w-full max-w-[78rem]">{children}</div>
      </div>
    </section>
  );
}
