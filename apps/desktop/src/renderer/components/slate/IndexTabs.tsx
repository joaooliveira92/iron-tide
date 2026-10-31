import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils.js";

export interface IndexTab<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly attention: boolean;
}

export interface IndexTabsProps<Id extends string> {
  readonly label: string;
  readonly groups: readonly (readonly IndexTab<Id>[])[];
  readonly openId: Id | null;
  readonly onOpen: (id: Id) => void;
  readonly testId?: string;
  readonly attached?: boolean;
}

export function IndexTabs<Id extends string>({
  label,
  groups,
  openId,
  onOpen,
  testId,
  attached = true,
}: IndexTabsProps<Id>) {
  return (
    <nav
      aria-label={label}
      data-testid={testId}
      className={cn("pointer-events-auto flex flex-col gap-3", attached ? "w-44" : "w-full")}
    >
      {groups.map((group) => (
        <ul key={group[0]?.id} className="m-0 flex list-none flex-col gap-1 p-0">
          {group.map((tab) => {
            const Icon = tab.icon;
            const open = tab.id === openId;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => onOpen(tab.id)}
                  className={cn(
                    "group relative flex w-full items-center gap-2.5 border border-admiralty-border bg-admiralty-surface-raised py-1.5 pl-3 pr-3 text-left text-admiralty-ink shadow-[0_4px_14px_-8px_rgb(11_26_43/0.55)] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal motion-reduce:transition-none",
                    attached
                      ? "rounded-l-sm border-r-0 hover:-translate-x-1"
                      : "rounded-sm",
                    attached && open && "-translate-x-2 hover:-translate-x-2",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 w-[3px] rounded-l-sm",
                      open ? "bg-admiralty-accent" : "bg-transparent",
                    )}
                  />
                  <Icon aria-hidden="true" className="size-[1.125rem] shrink-0 text-admiralty-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-medium leading-tight">
                      {tab.label}
                    </span>
                    <span
                      className={cn(
                        "block truncate text-[0.8125rem] leading-snug",
                        tab.attention
                          ? "font-medium text-admiralty-accent"
                          : "text-admiralty-ink-muted",
                      )}
                    >
                      {tab.detail}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}
