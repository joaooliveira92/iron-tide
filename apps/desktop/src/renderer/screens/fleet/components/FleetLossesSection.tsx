import type { PlayerLossesView } from "../fleet-sections-state.js";

export function FleetLossesSection({ losses }: { readonly losses: PlayerLossesView }) {
  if (losses.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading losses…</p>;
  }
  if (losses.status === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        Losses unavailable: {losses.message}
      </p>
    );
  }
  if (losses.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No ships lost yet.</p>;
  }
  return (
    <ul className="space-y-1 text-sm" aria-label="Ships lost">
      {losses.rows.map((row) => (
        <li key={row.key} className="flex flex-wrap gap-x-2">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted-foreground">
            {row.classLabel}
            {row.cause !== null && ` · ${row.cause}`} · {row.areaName} · {row.month}
          </span>
        </li>
      ))}
    </ul>
  );
}
