import { memo, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "../ui/button.js";
import { cn } from "../../lib/utils.js";
import { ScreenHeader, useScreenHeaderHost } from "../../shell/screen-header.js";

export interface PageHeaderBreadcrumb {
  readonly label: string;
  readonly onClick?: () => void;
}

export interface PageHeaderProps {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: ReactNode;
  readonly breadcrumbs?: readonly PageHeaderBreadcrumb[];
  readonly onBack?: () => void;
  readonly actions?: ReactNode;
  readonly className?: string;
}

export const PageHeader = memo(function PageHeader({
  icon: Icon,
  title,
  description,
  breadcrumbs = [],
  onBack,
  actions,
  className,
}: PageHeaderProps) {
  const hosted = useScreenHeaderHost();
  if (hosted && breadcrumbs.length === 0 && onBack === undefined) {
    return (
      <ScreenHeader title={title} icon={Icon}>
        {actions}
      </ScreenHeader>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-2">
        {onBack !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          {breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground"
            >
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.label} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3" />}
                  {crumb.onClick !== undefined ? (
                    <button
                      type="button"
                      onClick={crumb.onClick}
                      className="hover:text-foreground hover:underline"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
            {Icon !== undefined && <Icon className="h-5 w-5 text-primary" />}
            {title}
          </h2>
          {description !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
});
