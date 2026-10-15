import type { WorkshopView } from "@bluewave/ship-design";
import { Panel } from "./Panel.js";

interface Row {
  readonly id: string;
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

const gbp = (micro: number) => `£${Math.round(micro / 1_000_000).toLocaleString("en-US")}`;

function rowsOf(baseline: WorkshopView, view: WorkshopView): Row[] {
  const rows: Row[] = [
    {
      id: "cost",
      label: "Build cost",
      before: gbp(baseline.forecast.costMicro),
      after: gbp(view.forecast.costMicro),
    },
    {
      id: "class",
      label: "Classification",
      before: baseline.naturalClass ?? "not classified",
      after: view.naturalClass ?? "not classified",
    },
  ];
  const before = new Map(baseline.metrics.map((m) => [m.id, m.value]));
  for (const m of view.metrics)
    rows.push({ id: m.id, label: m.label, before: before.get(m.id) ?? "-", after: m.value });
  return rows;
}

/** "Developed from": what changed against the starting design, compiled under the same rules. Unchanged rows are hidden. */
export function ComparePanel({
  baseline,
  view,
  name,
}: {
  readonly baseline: WorkshopView;
  readonly view: WorkshopView;
  readonly name: string;
}) {
  const changed = rowsOf(baseline, view).filter((r) => r.before !== r.after);
  return (
    <Panel title="Compared with starting design">
      <p className="text-xs text-muted-foreground">Developed from: {name}</p>
      {changed.length === 0 ? (
        <p className="text-sm">No differences from the starting design.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Changes against {name}</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col">Measure</th>
              <th scope="col" className="text-right">
                Start
              </th>
              <th scope="col" className="text-right">
                Now
              </th>
            </tr>
          </thead>
          <tbody>
            {changed.map((r) => (
              <tr key={r.id} className="border-t">
                <th scope="row" className="text-left font-normal">
                  {r.label}
                </th>
                <td className="text-right tabular-nums text-muted-foreground">{r.before}</td>
                <td className="text-right tabular-nums">{r.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
