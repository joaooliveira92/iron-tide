import type { ReactNode } from "react";
import { UM_PER_INCH } from "@bluewave/ship-design";
import { useArmamentEditing, useArmamentMeta } from "./ArmamentEditing.js";

export function MountReadouts() {
  const { selected } = useArmamentEditing();
  const { format } = useArmamentMeta();
  if (selected === null) return null;
  return (
    <dl className="grid grid-cols-1 gap-y-1 text-sm">
      <Readout label="Mount type">{selected.mountType ?? "n/a"}</Readout>
      <Readout label="Fire control">{selected.fcClass ?? "none"}</Readout>
      <Readout label="Firing arc">
        {selected.arcDeg === null ? "n/a" : `${selected.arcDeg}°`}
      </Readout>
      <Readout label="Calibre">
        {selected.caliberUm === 0
          ? "n/a"
          : `${format.number(selected.caliberUm / UM_PER_INCH, {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}-inch`}
      </Readout>
      <Readout label="Weight">
        {format.measurement(selected.weightKg, "mass", { maximumFractionDigits: 1 })}
      </Readout>
      <Readout label="Cost">{format.moneyFromMicro(selected.costMicro)}</Readout>
    </dl>
  );
}

function Readout({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </>
  );
}
