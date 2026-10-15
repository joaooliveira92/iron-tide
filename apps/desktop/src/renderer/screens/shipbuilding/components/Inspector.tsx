import type { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import type { LocalTab } from "../design-sections.js";

export interface InspectorProps {
  /** The active section's name, e.g. "Armament". */
  readonly title: string;
  /** Where the player is, e.g. "Armament / Main battery / A". */
  readonly breadcrumb: readonly string[];
  /** The section's local tabs: sibling concepts in one flat row, never nested. */
  readonly tabs: readonly LocalTab[];
  readonly tab: string;
  readonly onTab: (tab: string) => void;
  /** Whether the pane is folded down to its restore strip. */
  readonly collapsed?: boolean;
  /** Folds the pane away, or restores it. */
  readonly onToggleCollapsed?: () => void;
  /** The active tab's content. */
  readonly children: ReactNode;
}

/** The shortcut that folds and restores the inspector, advertised on both toggles. */
const TOGGLE_SHORTCUT = "Meta+B Control+B";

/** The right inspector: the active section's local tabs, and the active tab's editors scrolling in their own pane. */
export function Inspector({
  title,
  breadcrumb,
  tabs,
  tab,
  onTab,
  collapsed = false,
  onToggleCollapsed,
  children,
}: InspectorProps) {
  if (collapsed) {
    return (
      <aside
        aria-label={`Inspector: ${title}`}
        data-collapsed="true"
        className="flex h-full min-h-0 flex-col items-center gap-2 border-l bg-background py-2"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Show inspector"
          aria-keyshortcuts={TOGGLE_SHORTCUT}
          title="Show inspector (⌘/Ctrl+B)"
          onClick={onToggleCollapsed}
        >
          <PanelRightOpen aria-hidden="true" className="size-4" />
        </Button>
        <span
          aria-hidden="true"
          className="text-xs text-muted-foreground [writing-mode:vertical-rl]"
        >
          {title}
        </span>
      </aside>
    );
  }
  return (
    <aside aria-label={`Inspector: ${title}`} className="flex h-full min-h-0 flex-col border-l">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1">
          {breadcrumb.map((part, i) => (
            <li key={`${i}-${part}`} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">/</span>}
              <span
                className={i === breadcrumb.length - 1 ? "font-medium text-foreground" : undefined}
              >
                {part}
              </span>
            </li>
          ))}
        </ol>
        {onToggleCollapsed !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="Hide inspector"
            aria-keyshortcuts={TOGGLE_SHORTCUT}
            title="Hide inspector (⌘/Ctrl+B)"
            onClick={onToggleCollapsed}
          >
            <PanelRightClose aria-hidden="true" className="size-4" />
          </Button>
        )}
      </nav>
      <Tabs
        value={tab}
        onValueChange={(v) => onTab(String(v))}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b px-3 py-2">
          <TabsList aria-label={`${title} tabs`} className="w-full justify-start">
            {tabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="min-w-0 flex-1 max-xl:px-1.5 max-xl:text-xs"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent
          value={tab}
          className="themed-scrollbar mt-0 min-h-0 flex-1 space-y-4 overflow-y-auto p-3"
        >
          {children}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
