import { useState } from "react";
import type { DraftEdit } from "@bluewave/ship-design";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { schemeEdit, type ProtectionModel, type SchemeChoice } from "../protection-view.js";
import type { SchemeDiagram } from "../scheme-diagram.js";

/** A rough side view of the scheme's plates on a stylised hull. Decorative: the choice is named in text beside it. */
function SchemeDiagramView({ diagram }: { readonly diagram: SchemeDiagram }) {
  return (
    <svg
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      className="h-16 w-full max-w-xs rounded border bg-muted/30"
      aria-hidden="true"
    >
      <polygon
        points={diagram.hull.map(([x, y]) => `${x},${y}`).join(" ")}
        className="fill-none stroke-muted-foreground"
        strokeWidth={1}
      />
      {diagram.plates.map((p) => (
        <line
          key={p.region}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          className="stroke-foreground"
          strokeWidth={p.y1 === p.y2 ? 2 : 4}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/**
 * The armour-scheme selector: the named schemes with lock badges for the ones not yet unlocked, a rough diagram of
 * the highlighted one, and a single Apply that sets the regions as one undoable edit. The per-region editor below is the
 * "Custom" view; any manual edit there returns the label to Custom.
 */
export function ArmourSchemeSelector({
  model,
  edit,
}: {
  readonly model: ProtectionModel;
  readonly edit: (e: DraftEdit) => void;
}) {
  const [picked, setPicked] = useState<SchemeChoice["id"] | null>(null);
  const shown = model.schemes.find((s) => s.id === picked) ?? model.schemes.find((s) => s.active);
  const apply = () => {
    if (shown === undefined) return;
    const e = schemeEdit(model, shown.id);
    if (e !== null) edit(e);
  };
  return (
    <section aria-label="Armour scheme" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <h3 className="font-medium">Armour scheme</h3>
        <Badge variant="outline">{model.schemeLabel}</Badge>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Armour schemes">
        {model.schemes.map((s) => (
          <li key={s.id}>
            <Button
              type="button"
              size="sm"
              variant={shown?.id === s.id ? "default" : "outline"}
              aria-pressed={shown?.id === s.id}
              disabled={s.locked}
              onClick={() => setPicked(s.id)}
            >
              {s.label}
              {s.locked && (
                <Badge variant="secondary" className="ml-2">
                  {s.lockedReason}
                </Badge>
              )}
            </Button>
          </li>
        ))}
      </ul>
      {shown !== undefined && (
        <div className="flex flex-wrap items-center gap-3">
          <SchemeDiagramView diagram={shown.diagram} />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              {shown.label}: {shown.regions.length} region
              {shown.regions.length === 1 ? "" : "s"} ({shown.citation}).
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={shown.active}
              onClick={apply}
            >
              {shown.active ? "Applied" : `Apply ${shown.label}`}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
