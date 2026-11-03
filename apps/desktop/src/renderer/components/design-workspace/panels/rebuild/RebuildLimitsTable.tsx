import type { LimitRow } from "../../rebuildView.js";

export function RebuildLimitsTable({ rows }: { readonly rows: readonly LimitRow[] }) {
  return (
    <table className="w-full text-xs" aria-label="Rebuild limits">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 font-normal">Limit</th>
          <th className="py-1 font-normal">Your change</th>
          <th className="py-1 font-normal">A rebuild may</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t">
            <th scope="row" className="py-1 text-left font-normal">
              {row.label}
            </th>
            <td className={row.over ? "py-1 font-medium text-destructive" : "py-1 tabular-nums"}>
              {row.change}
              {row.over ? " (over the limit)" : ""}
            </td>
            <td className="py-1 text-muted-foreground">{row.limit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
