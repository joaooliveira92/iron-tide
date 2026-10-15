export function SandboxStat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border bg-muted/40 p-2">
      <div className="text-[12px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
