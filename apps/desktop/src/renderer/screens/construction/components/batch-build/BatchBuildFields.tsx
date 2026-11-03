import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import type { ForeignBuilderCandidate } from "@bluewave/phase-engine";

export function BatchDesignField({
  designs,
  value,
  onChange,
}: {
  readonly designs: readonly CompiledDesignVersion[];
  readonly value: string | null;
  readonly onChange: (designId: string) => void;
}) {
  return (
    <label className="space-y-0.5 text-xs text-muted-foreground">
      <span>Batch design</span>
      <select
        aria-label="Batch design"
        className="block h-9 min-w-56 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {designs.map((design) => (
          <option key={design.designId} value={design.designId}>
            {design.className}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BatchBuilderField({
  builders,
  value,
  onChange,
}: {
  readonly builders: readonly ForeignBuilderCandidate[];
  readonly value: string | null;
  readonly onChange: (nationId: string | null) => void;
}) {
  return (
    <label className="space-y-0.5 text-xs text-muted-foreground">
      <span>Builder</span>
      <select
        aria-label="Builder"
        className="block h-9 min-w-48 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">Your own yards</option>
        {builders.map((builder) => (
          <option key={builder.nationId} value={builder.nationId}>
            {builder.name}
            {builder.capabilitySatisfied ? "" : " (unavailable)"}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BatchQuantityField({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (quantity: number) => void;
}) {
  return (
    <label className="space-y-0.5 text-xs text-muted-foreground">
      <span>Quantity</span>
      <input
        aria-label="Batch quantity"
        className="block h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
        type="number"
        min={1}
        max={12}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
