import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog.js";

export interface SettingsNavItem<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly summary: string;
  readonly icon: LucideIcon;
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="space-y-0.5 px-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description !== undefined && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  control,
  stacked = false,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  stacked?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "gap-3 px-4 py-3",
        stacked ? "flex flex-col" : "flex items-center justify-between gap-6",
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description !== undefined && (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
      {control !== undefined && (
        <div className={stacked ? "[&>div]:justify-start" : "flex shrink-0 justify-end"}>
          {control}
        </div>
      )}
    </div>
  );
}

function SettingsNav<Id extends string>({
  label,
  items,
  activeId,
  onSelect,
}: {
  label: string;
  items: readonly SettingsNavItem<Id>[];
  activeId: Id;
  onSelect: (id: Id) => void;
}) {
  return (
    <nav aria-label={label} className="w-60 shrink-0 overflow-y-auto border-r bg-muted/30 p-2">
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-accent text-foreground",
                )}
                onClick={() => onSelect(item.id)}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingsModal<Id extends string>({
  open,
  onOpenChange,
  title,
  navLabel,
  items,
  activeId,
  onSelect,
  headerAction,
  children,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  navLabel: string;
  items: readonly SettingsNavItem<Id>[];
  activeId: Id;
  onSelect: (id: Id) => void;
  headerAction?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  const active = items.find((item) => item.id === activeId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent flush data-testid={testId}>
        <div className="flex min-h-0 flex-1">
          <SettingsNav label={navLabel} items={items} activeId={activeId} onSelect={onSelect} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b pl-6 pr-14">
              <DialogTitle className="text-sm font-normal">
                <span className="text-muted-foreground">{title} / </span>
                <span className="font-medium">{active?.label}</span>
              </DialogTitle>
              {headerAction}
            </header>
            <DialogDescription className="sr-only">{active?.summary}</DialogDescription>
            <DialogBody className="px-6 py-6">
              <div className="mx-auto w-full max-w-3xl space-y-8">{children}</div>
            </DialogBody>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
