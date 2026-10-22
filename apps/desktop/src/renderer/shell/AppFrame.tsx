import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Alert, AlertDescription } from "../components/ui/alert.js";
import { SidebarInset, SidebarProvider } from "../components/ui/sidebar.js";
import { BottomNav } from "./BottomNav.js";
import type { Screen } from "./campaign-screen-registry.js";
import type { CampaignReads } from "./campaign-reads.js";
import { StatusStrip } from "./StatusStrip.js";

export interface AppFrameProps {
  readonly campaignSessionId: string | null;
  readonly campaignReads: CampaignReads | null;
  readonly screen: Screen;
  readonly saveMessage: string | null;
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly onSelectScreen: (screen: Screen) => void;
}

export function AppFrame({
  campaignSessionId,
  campaignReads,
  screen,
  saveMessage,
  header,
  children,
  onSelectScreen,
}: AppFrameProps) {
  const underlay = screen === "overview";
  const frameRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    const measure = () => {
      frame.style.setProperty("--chrome-top", `${topRef.current?.offsetHeight ?? 0}px`);
      frame.style.setProperty("--chrome-bottom", `${bottomRef.current?.offsetHeight ?? 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (topRef.current !== null) observer.observe(topRef.current);
    if (bottomRef.current !== null) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [underlay, campaignSessionId]);

  return (
    <SidebarProvider
      ref={frameRef}
      className="relative h-svh flex-col overflow-hidden bg-transparent"
    >
      <div ref={topRef} data-underlay={underlay} className="group/chrome relative z-20 shrink-0">
        {header}
      </div>
      <div
        className={
          underlay
            ? "absolute inset-0 z-0 flex overflow-hidden"
            : "flex min-h-0 flex-1 overflow-hidden"
        }
      >
        <SidebarInset className="themed-scrollbar relative min-h-0 overflow-auto bg-transparent">
          {saveMessage !== null && (
            <Alert
              variant="default"
              className="absolute left-4 right-4 top-2 z-50 border backdrop-blur-sm"
            >
              <AlertDescription>{saveMessage}</AlertDescription>
            </Alert>
          )}
          {children}
        </SidebarInset>
      </div>
      <div
        ref={bottomRef}
        data-underlay={underlay}
        className="group/chrome relative z-[45] mt-auto shrink-0"
      >
        {campaignSessionId !== null && campaignReads !== null && (
          <StatusStrip reads={campaignReads} />
        )}
        {campaignSessionId !== null && (
          <BottomNav
            screen={screen}
            onSelect={onSelectScreen}
            footer={campaignSessionId}
            sessionId={campaignSessionId}
          />
        )}
      </div>
    </SidebarProvider>
  );
}
