import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export interface ScreenHeaderProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly className?: string;
}

export const ScreenHeader = memo(function ScreenHeader({
  icon,
  title,
  description,
  className,
}: ScreenHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden="true" className="text-muted-foreground">
        {icon}
      </span>
      <div>
        <h1 className="text-xl font-medium tracking-tight text-pretty">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
});
