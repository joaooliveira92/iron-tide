import { REBUILD_ACTIONS, type RebuildAction } from "./rebuildDraft.js";

export function RebuildActionSelect({
  value,
  onChange,
}: {
  readonly value: RebuildAction;
  readonly onChange: (action: RebuildAction) => void;
}) {
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span>Rebuild action</span>
      <select
        aria-label="Rebuild action"
        className="block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
        value={value}
        onChange={(event) => onChange(event.target.value as RebuildAction)}
      >
        {REBUILD_ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
