import type { RebuildCheckView } from "../../../../../shared/design-contract.js";

export function RebuildFindings({ findings }: { readonly findings: RebuildCheckView["findings"] }) {
  return (
    <>
      {findings.map((f) => (
        <div key={f.id} className="space-y-1 rounded-md border p-2">
          <p className="font-medium">{f.what}</p>
          <p className="text-muted-foreground">{f.why}</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {f.remedies.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
