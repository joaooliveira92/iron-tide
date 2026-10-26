import type { WorkshopView } from "@bluewave/ship-design";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card.js";
import { SlateBody, SlateFacts, SlateHeader } from "../../ui/slate.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Panel } from "./Panel.js";

export function LedgerPanel({ view }: { readonly view: WorkshopView }) {
  const format = usePresentationFormat();
  const tonnes = (kg: number) => format.measurement(kg, "mass", { maximumFractionDigits: 0 });
  return (
    <Panel title="Weight summary">
      <div className="flex h-3 w-full overflow-hidden rounded bg-muted" aria-hidden="true">
        {view.ledger.map((r, i) => (
          <HoverCard key={r.category}>
            <HoverCardTrigger
              delay={50}
              closeDelay={50}
              render={<div />}
              style={{ width: `${r.shareBp / 100}%`, opacity: 0.35 + (i % 4) * 0.2 }}
              className="bg-primary transition-opacity hover:opacity-100!"
            />
            <HoverCardContent side="top" className="w-48">
              <SlateHeader title={r.category} className="capitalize" />
              <SlateBody>
                <SlateFacts
                  rows={[
                    { label: "Weight", value: tonnes(r.kg) },
                    { label: "Share", value: format.percent(r.shareBp, 1) },
                  ]}
                />
              </SlateBody>
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Displacement ledger</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col">Category</th>
            <th scope="col" className="text-right">
              Tonnes
            </th>
            <th scope="col" className="text-right">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {view.ledger.map((r) => (
            <tr key={r.category} className="border-t">
              <th scope="row" className="text-left font-normal">
                {r.category}
              </th>
              <td className="text-right tabular-nums">{tonnes(r.kg)}</td>
              <td className="text-right tabular-nums">{format.percent(r.shareBp, 1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <th scope="row" className="text-left">
              Total / buoyancy at design draught
            </th>
            <td className="text-right tabular-nums" colSpan={2}>
              {tonnes(view.totalKg)} / {tonnes(view.buoyantKg)}
            </td>
          </tr>
        </tfoot>
      </table>
    </Panel>
  );
}
