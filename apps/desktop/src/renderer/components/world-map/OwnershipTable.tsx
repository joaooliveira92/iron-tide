import type { AreaOwnershipRow } from "./map-a11y.js";

export function OwnershipTable({ rows }: { readonly rows: readonly AreaOwnershipRow[] }) {
  return (
    <div className="sr-only">
      <table>
        <caption>Area control</caption>
        <thead>
          <tr>
            <th scope="col">Area</th>
            <th scope="col">Controlled by</th>
            <th scope="col">Fleets</th>
            <th scope="col">Strength</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} aria-selected={row.selected}>
              <th scope="row">{row.name}</th>
              <td>{row.owner ?? "Unclaimed"}</td>
              <td>{row.fleets}</td>
              <td>{row.strength ?? "No ships"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
