import { Info } from "lucide-react";
import type { DesignDraft } from "@bluewave/ship-design";
import { formatHullMetres } from "../../../../lib/presentation-format/hull-metres.js";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover.js";
import { plural } from "../../plural.js";
import { HullPlanLegend } from "./HullPlanLegend.js";
import { legendEntries } from "./legend.js";
import type { PlanModel } from "./planModel.js";

export function HullPlanStatusBar({
  draft,
  model,
}: {
  readonly draft: DesignDraft;
  readonly model: PlanModel;
}) {
  const format = usePresentationFormat();
  const { frame, facts, form, placedFunnels, masts } = model;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        {formatHullMetres(frame.lengthM, 0)} m × {formatHullMetres(frame.beamM, 1)} m ·{" "}
        {plural(draft.placements.length, "fitting", undefined, undefined, format)} · Schematic, not
        a lines plan.
      </span>
      <Popover>
        <PopoverTrigger
          render={<button type="button" />}
          className="inline-flex items-center gap-1 rounded underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info aria-hidden="true" className="size-3" />
          Drawing key
        </PopoverTrigger>
        <PopoverContent aria-label="Drawing key" className="w-80 space-y-3 text-xs">
          <HullPlanLegend
            entries={legendEntries(
              {
                facts,
                waterplaneCoeffBp: form?.waterplaneCoeffBp,
                lcbPermille: form?.lcbPermille,
                sheerBp: form?.sheerBp,
                funnels: placedFunnels,
                masts,
              },
              format,
            )}
          />
          <p>
            Schematic design views, not construction drawings or a true lines plan. The hull form's
            waterplane coefficient, LCB, sheer and the placed fittings drive the drawing; bow and
            stern character, sheer emphasis, deck-house steps and funnel shape are visual
            conventions. Of the fittings, station, side and arc width are data, and so are a gun's
            calibre, gun count and mount type; the mount's silhouette follows the designing nation
            and period, a convention. Arcs show the effective beam arc after obstruction.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
