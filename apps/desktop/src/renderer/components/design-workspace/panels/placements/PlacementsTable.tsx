import type { ReactNode } from "react";

export function PlacementsTable({ children }: { readonly children: ReactNode }) {
  return (
    <div className="@container overflow-x-auto">
      <table role="table" className="w-full table-fixed text-sm @max-xl:block">
        <thead role="rowgroup" className="@max-xl:sr-only">
          <tr role="row" className="text-left text-xs text-muted-foreground">
            <th role="columnheader" className="w-[30%] p-1">
              Fitting
            </th>
            <th className="w-24 p-1">Zone</th>
            <th className="w-20 p-1">Station</th>
            <th className="p-1">Settings</th>
            <th className="w-20 p-1">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="@max-xl:block">
          {children}
        </tbody>
      </table>
    </div>
  );
}
