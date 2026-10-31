import { useEffect, useRef, type ReactNode } from "react";

export const INDEX_TABS_CLEARANCE = "12.5rem";

export interface ChartDeskProps {
  readonly tabs: ReactNode;
  readonly drawer: ReactNode | null;
  readonly slip: ReactNode | null;
}

const SLIP_GAP_PX = 12;

export function ChartDesk({ tabs, drawer, slip }: ChartDeskProps) {
  const deskRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);
  const showSlip = drawer === null && slip !== null;

  useEffect(() => {
    const host = deskRef.current?.parentElement;
    if (host === null || host === undefined) return;
    const slipElement = slipRef.current;
    if (!showSlip || slipElement === null) {
      host.style.setProperty("--chrome-slip", "0px");
      return;
    }
    const measure = () =>
      host.style.setProperty("--chrome-slip", `${slipElement.offsetHeight + SLIP_GAP_PX}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slipElement);
    return () => {
      observer.disconnect();
      host.style.setProperty("--chrome-slip", "0px");
    };
  }, [showSlip]);

  return (
    <div
      ref={deskRef}
      className="pointer-events-none absolute inset-0 z-[9999] flex items-stretch gap-3 pb-[calc(var(--chrome-bottom,0px)+0.75rem)] pl-3 pt-[calc(var(--chrome-top,0px)+0.75rem)]"
    >
      <div className="relative min-w-0 flex-1">
        {showSlip && (
          <div
            ref={slipRef}
            className="absolute inset-x-0 bottom-0 flex justify-center pl-[18.75rem]"
          >
            {slip}
          </div>
        )}
      </div>
      {drawer}
      <div className="themed-scrollbar -ml-3 max-h-full shrink-0 self-start overflow-y-auto pl-3">
        {tabs}
      </div>
    </div>
  );
}
