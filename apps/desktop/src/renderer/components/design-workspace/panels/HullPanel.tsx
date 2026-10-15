import { bp, kg, mm, type DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../content.js";
import { NumberField, SelectField } from "../fields.js";
import { Panel } from "./Panel.js";
import type { Edit } from "./types.js";

export function HullPanel({
  draft,
  content,
  edit,
}: {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly edit: Edit;
}) {
  const h = draft.hull;
  return (
    <Panel title="Hull and displacement">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SelectField
          label="Hull form"
          value={h.hullFormId}
          options={content.hullForms.map((f) => ({
            value: f.id,
            label: f.id.replaceAll("_", " "),
          }))}
          onChange={(v) => edit({ kind: "set_hull", patch: { hullFormId: v } })}
        />
        <SelectField
          label="Material"
          value={h.materialId}
          options={[
            { value: "iron", label: "Iron" },
            { value: "mild_steel", label: "Mild steel" },
            { value: "high_tensile", label: "High-tensile steel" },
          ]}
          onChange={(v) => edit({ kind: "set_hull", patch: { materialId: v } })}
        />
        <SelectField
          label="Subdivision"
          value={String(h.subdivisionGrade)}
          options={[0, 1, 2, 3, 4].map((g) => ({ value: String(g), label: `Grade ${g}` }))}
          onChange={(v) =>
            edit({ kind: "set_hull", patch: { subdivisionGrade: Number(v) as 0 | 1 | 2 | 3 | 4 } })
          }
        />
        <NumberField
          label="Length (waterline)"
          unit="m"
          value={h.lengthWl}
          scale={1000}
          decimals={1}
          onCommit={(v) => edit({ kind: "set_hull", patch: { lengthWl: mm(v) } })}
        />
        <NumberField
          label="Beam"
          unit="m"
          value={h.beam}
          scale={1000}
          decimals={2}
          onCommit={(v) => edit({ kind: "set_hull", patch: { beam: mm(v) } })}
        />
        <NumberField
          label="Draught"
          unit="m"
          value={h.draught}
          scale={1000}
          decimals={2}
          onCommit={(v) => edit({ kind: "set_hull", patch: { draught: mm(v) } })}
        />
        <NumberField
          label="Depth to main deck"
          unit="m"
          value={h.depthToMainDeck}
          scale={1000}
          decimals={2}
          onCommit={(v) => edit({ kind: "set_hull", patch: { depthToMainDeck: mm(v) } })}
        />
        <NumberField
          label="Block coefficient"
          value={h.blockCoeffBp}
          scale={10_000}
          decimals={2}
          onCommit={(v) => edit({ kind: "set_hull", patch: { blockCoeffBp: bp(v) } })}
        />
        <NumberField
          label="Target displacement"
          unit="t"
          value={h.targetDisplacementKg}
          scale={1000}
          onCommit={(v) => edit({ kind: "set_hull", patch: { targetDisplacementKg: kg(v) } })}
        />
        <NumberField
          label="Design margin"
          unit="%"
          value={h.designMarginBp}
          scale={100}
          decimals={1}
          onCommit={(v) => edit({ kind: "set_hull", patch: { designMarginBp: bp(v) } })}
        />
        <NumberField
          label="Growth reserve"
          unit="%"
          value={h.growthReserveBp}
          scale={100}
          decimals={1}
          onCommit={(v) => edit({ kind: "set_hull", patch: { growthReserveBp: bp(v) } })}
        />
      </div>
    </Panel>
  );
}
