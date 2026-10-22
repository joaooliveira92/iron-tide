import type { StatusRowModel } from "../../site-header-state.js";

export interface StatusRowProps {
  readonly row: StatusRowModel;
}

export function StatusRow({ row }: StatusRowProps) {
  return (
    <div className="flex w-full items-center justify-between px-1 text-xs text-muted-foreground">
      <span className="tracking-wider uppercase">{row.leading}</span>
      <span className="uppercase">{row.trailing}</span>
    </div>
  );
}
