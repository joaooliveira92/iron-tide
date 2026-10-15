import type { PreferencesRowModel } from "../../site-header-state.js";

export interface PreferencesRowProps {
  readonly row: PreferencesRowModel;
}

/** The options bar: the active preferences area and its detail. */
export function PreferencesRow({ row }: PreferencesRowProps) {
  return (
    <div className="flex w-full items-center px-1 text-xs text-muted-foreground">
      <span className="mr-1 tracking-wider uppercase">{row.label}</span>
      <span className="tracking-wider uppercase">{row.detail}</span>
    </div>
  );
}
