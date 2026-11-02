import type { RebuildCheckView } from "../../../../../shared/design-contract.js";
import type { PresentationFormat } from "../../../../lib/presentation-format/index.js";

export function BulgeProjection({
  check,
  massKg,
  format,
}: {
  readonly check: RebuildCheckView;
  readonly massKg: number;
  readonly format: PresentationFormat;
}) {
  return (
    <div className="rounded-md border p-2 text-xs" aria-label="Bulge projection">
      <p className="font-medium">Bulge (torpedo blister)</p>
      <p className="text-muted-foreground">
        A bulge is added hull mass: it raises torpedo protection at a price in speed.
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3">
        <dt className="text-muted-foreground">Blister mass</dt>
        <dd className="text-right tabular-nums">
          {format.measurement(massKg, "mass", { maximumFractionDigits: 0 })}
        </dd>
        {check.bulgeProtectionGainBp !== null && (
          <>
            <dt className="text-muted-foreground">Torpedo protection</dt>
            <dd className="text-right tabular-nums">
              +{format.percent(check.bulgeProtectionGainBp, 1)}
            </dd>
          </>
        )}
        {check.measures !== null && (
          <>
            <dt className="text-muted-foreground">Speed</dt>
            <dd className="text-right tabular-nums">
              {format.number(check.measures.speedChangeMilliKnots / 1000, {
                maximumFractionDigits: 1,
              })}{" "}
              kn
            </dd>
            <dt className="text-muted-foreground">Displacement</dt>
            <dd className="text-right tabular-nums">
              {format.percent(check.measures.displacementChangeBp, 1)}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
