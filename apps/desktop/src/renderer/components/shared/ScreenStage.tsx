import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader.js";

export interface ScreenStageProps {
  readonly guidedTarget: string;
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}

export function ScreenStage({
  guidedTarget,
  icon,
  title,
  description,
  actions,
  className = "space-y-6",
  children,
}: ScreenStageProps) {
  return (
    <div data-guided-target={guidedTarget} className={className}>
      <PageHeader icon={icon} title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}
