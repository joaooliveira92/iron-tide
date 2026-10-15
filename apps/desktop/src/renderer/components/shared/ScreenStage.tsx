import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader.js";

export interface ScreenStageProps {
  /** The guided-inspection target id (`data-guided-target`). */
  readonly guidedTarget: string;
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  /** Vertical spacing between the header and the body; defaults to `space-y-6`. */
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * The common screen frame: the `data-guided-target` container (guided
 * inspection and the tutorial overlay both locate screens by this attribute)
 * plus the page header. Screens own everything below it, so the frame is
 * defined exactly once instead of per screen.
 */
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
