import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import type { LocalTab } from "../design-sections.js";

export interface DrawerBodyProps {
  readonly title: string;
  readonly tabs: readonly LocalTab[];
  readonly tab: string;
  readonly onTab: (tab: string) => void;
  readonly children: ReactNode;
}

export function DrawerBody({ title, tabs, tab, onTab, children }: DrawerBodyProps) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTab(String(v))} className="flex flex-col gap-3">
      <TabsList aria-label={`${title} tabs`} className="w-full justify-start">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="min-w-0 flex-1 px-1.5 text-xs">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={tab} className="mt-0 space-y-4">
        {children}
      </TabsContent>
    </Tabs>
  );
}
