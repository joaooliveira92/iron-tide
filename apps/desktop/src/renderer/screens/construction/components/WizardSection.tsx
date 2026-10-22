import type { ReactNode } from "react";

export interface WizardSectionProps {
  readonly title: string;
  readonly testId: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function WizardSection({ title, testId, className, children }: WizardSectionProps) {
  return (
    <div data-testid={testId} className={className}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}
