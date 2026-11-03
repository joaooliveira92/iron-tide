import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card.js";

export function BatchBuildRoot({ children }: { readonly children: ReactNode }) {
  return <Card data-testid="batch-build-dialog">{children}</Card>;
}

export function BatchBuildHeader() {
  return (
    <CardHeader>
      <CardTitle className="text-sm font-medium">Order a class batch (1–12)</CardTitle>
      <CardDescription>
        One order places up to twelve hulls of one approved design; the engine assigns their names.
      </CardDescription>
    </CardHeader>
  );
}

export function BatchBuildContent({ children }: { readonly children: ReactNode }) {
  return <CardContent className="space-y-4">{children}</CardContent>;
}

export function BatchBuildFields({ children }: { readonly children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}
