import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card.js";

type PanelBodyVariant = "beneath-header" | "standalone" | "flush";

const bodyClassName: Record<PanelBodyVariant, string> = {
  "beneath-header": "space-y-3 p-4 pt-0",
  standalone: "space-y-3 p-4",
  flush: "space-y-2 p-0",
};

export interface PanelRootProps {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export interface PanelHeaderProps {
  readonly children: ReactNode;
}

export interface PanelBodyProps {
  readonly variant: PanelBodyVariant;
  readonly children: ReactNode;
}

export interface PanelActionsProps {
  readonly children: ReactNode;
}

export interface PanelProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly hideTitle?: boolean;
}

function PanelRoot({ label, className, children }: PanelRootProps) {
  return (
    <Card className={className} role="region" aria-label={label}>
      {children}
    </Card>
  );
}

function PanelHeader({ children }: PanelHeaderProps) {
  return (
    <CardHeader className="p-4 pb-2">
      <CardTitle className="text-base">{children}</CardTitle>
    </CardHeader>
  );
}

function PanelBody({ variant, children }: PanelBodyProps) {
  return <CardContent className={bodyClassName[variant]}>{children}</CardContent>;
}

function PanelActions({ children }: PanelActionsProps) {
  return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

function PanelLegacy({ title, children, className, hideTitle = false }: PanelProps) {
  return (
    <PanelRoot label={title} className={className}>
      {!hideTitle && <PanelHeader>{title}</PanelHeader>}
      <PanelBody variant={hideTitle ? "standalone" : "beneath-header"}>{children}</PanelBody>
    </PanelRoot>
  );
}

export const Panel = Object.assign(PanelLegacy, {
  Root: PanelRoot,
  Header: PanelHeader,
  Body: PanelBody,
  Actions: PanelActions,
});
