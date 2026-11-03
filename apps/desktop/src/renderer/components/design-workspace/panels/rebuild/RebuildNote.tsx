import type { ReactNode } from "react";

export function RebuildNote({ children }: { readonly children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
