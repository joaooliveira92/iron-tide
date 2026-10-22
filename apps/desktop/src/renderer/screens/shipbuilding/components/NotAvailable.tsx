import type { ReactNode } from "react";
import { CircleSlash } from "lucide-react";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";

export function NotAvailable({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Empty>
      <EmptyIcon>
        <CircleSlash aria-hidden="true" />
      </EmptyIcon>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{children}</EmptyDescription>
    </Empty>
  );
}
