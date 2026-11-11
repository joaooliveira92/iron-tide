import { bp, kg, mm } from "@bluewave/ship-design";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { useDesignActions, useDesignState } from "../DesignWorkspaceContext.js";
import { domesticDock } from "../domesticDock.js";
import { NumberField, SelectField } from "../fields.js";
import { BuildStatesNotice } from "./BuildStatesNotice.js";
import { Panel } from "./Panel.js";

export function HullPanel() {
  const { draft, content, ctx } = useDesignState();
  const { edit, errorFor } = useDesignActions();
  const format = usePresentationFormat();
  const h = draft.hull;
  const dock = domesticDock(ctx);
  return (
    <Panel title="Hull and displacement">
      {dock !== null && (
        <p
          className="text-xs text-muted-foreground"
          data-max-build-kg={dock.maximumNewConstructionMassKg}
        >
          Largest ship your docks can build:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {format.measurement(dock.maximumNewConstructionMassKg, "mass", {
              maximumFractionDigits: 0,
            })}
          </span>
        </p>
      )}
      <BuildStatesNotice kinds={["yard-too-small"]} />
      <div className="@container">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 @xl:grid-cols-3">
          <SelectField
            label="Hull form"
            value={h.hullFormId}
            options={content.hullForms.map((f) => ({
              value: f.id,
              label: f.id.replaceAll("_", " "),
            }))}
            error={errorFor("set_hull:hullFormId")}
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
            error={errorFor("set_hull:materialId")}
            onChange={(v) =>
              edit({
                kind: "set_hull",
                patch: {
                  materialId: v,
                },
              })
            }
          />
          <SelectField
            label="Subdivision"
            value={String(h.subdivisionGrade)}
            options={[0, 1, 2, 3, 4].map((g) => ({ value: String(g), label: `Grade ${g}` }))}
            error={errorFor("set_hull:subdivisionGrade")}
            onChange={(v) =>
              edit({
                kind: "set_hull",
                patch: {
                  subdivisionGrade: Number(v) as 0 | 1 | 2 | 3 | 4,
                },
              })
            }
          />
          <NumberField
            label="Length (waterline)"
            unit="m"
            value={h.lengthWl}
            scale={1000}
            decimals={1}
            error={errorFor("set_hull:lengthWl")}
            onCommit={(v) => edit({ kind: "set_hull", patch: { lengthWl: mm(v) } })}
          />
          <NumberField
            label="Beam"
            unit="m"
            value={h.beam}
            scale={1000}
            decimals={2}
            error={errorFor("set_hull:beam")}
            onCommit={(v) => edit({ kind: "set_hull", patch: { beam: mm(v) } })}
          />
          <NumberField
            label="Draught"
            unit="m"
            value={h.draught}
            scale={1000}
            decimals={2}
            error={errorFor("set_hull:draught")}
            onCommit={(v) => edit({ kind: "set_hull", patch: { draught: mm(v) } })}
          />
          <NumberField
            label="Depth to main deck"
            unit="m"
            value={h.depthToMainDeck}
            scale={1000}
            decimals={2}
            error={errorFor("set_hull:depthToMainDeck")}
            onCommit={(v) => edit({ kind: "set_hull", patch: { depthToMainDeck: mm(v) } })}
          />
          <SelectField
            label="Freeboard"
            value={h.freeboardProfile ?? "NORMAL"}
            options={[
              { value: "NORMAL", label: "Normal" },
              {
                value: "LOW",
                label: "Low",
                description: "Lighter hull, but less reserve buoyancy.",
              },
            ]}
            error={errorFor("set_hull:freeboardProfile")}
            onChange={(v) =>
              edit({
                kind: "set_hull",
                patch: {
                  freeboardProfile: v === "LOW" ? "LOW" : "NORMAL",
                },
              })
            }
          />
          <NumberField
            label="Block coefficient"
            value={h.blockCoeffBp}
            scale={10_000}
            decimals={2}
            error={errorFor("set_hull:blockCoeffBp")}
            onCommit={(v) => edit({ kind: "set_hull", patch: { blockCoeffBp: bp(v) } })}
          />
          <NumberField
            label="Target displacement"
            unit="t"
            value={h.targetDisplacementKg}
            scale={1000}
            error={errorFor("set_hull:targetDisplacementKg")}
            onCommit={(v) =>
              edit({
                kind: "set_hull",
                patch: {
                  targetDisplacementKg: kg(v),
                },
              })
            }
          />
          <NumberField
            label="Design margin"
            unit="%"
            value={h.designMarginBp}
            scale={100}
            decimals={1}
            error={errorFor("set_hull:designMarginBp")}
            onCommit={(v) => edit({ kind: "set_hull", patch: { designMarginBp: bp(v) } })}
          />
          <NumberField
            label="Growth reserve"
            unit="%"
            value={h.growthReserveBp}
            scale={100}
            decimals={1}
            error={errorFor("set_hull:growthReserveBp")}
            onCommit={(v) => edit({ kind: "set_hull", patch: { growthReserveBp: bp(v) } })}
          />
        </div>
      </div>
    </Panel>
  );
}
