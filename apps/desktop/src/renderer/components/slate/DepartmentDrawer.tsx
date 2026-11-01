import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export interface DepartmentDrawerProps {
  readonly title: string;
  readonly summary: string;
  readonly width: "narrow" | "wide";
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly hotkeyScope?: boolean;
}

export function DepartmentDrawer({
  title,
  summary,
  width,
  onClose,
  children,
  testId,
  hotkeyScope = false,
}: DepartmentDrawerProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement;
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [title]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[role="listbox"], [role="menu"]') !== null) {
        return;
      }
      event.preventDefault();
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-testid={testId}
      data-fleet-hotkey-scope={hotkeyScope ? "" : undefined}
      className={cn(
        "pointer-events-auto flex h-full max-w-full flex-col rounded-sm border border-admiralty-border bg-admiralty-surface-raised text-admiralty-ink shadow-[0_12px_40px_-12px_rgb(11_26_43/0.6)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-6 motion-safe:duration-200",
        width === "wide" ? "w-[44rem]" : "w-[28rem]",
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-admiralty-border px-5 py-4">
        <div className="min-w-0">
          <h2
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-xl font-semibold leading-tight tracking-tight focus:outline-none"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm leading-snug text-admiralty-ink-muted">{summary}</p>
        </div>
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={onClose}
          className="-mr-1 -mt-1 rounded-sm p-1.5 text-admiralty-ink-muted hover:bg-admiralty-surface hover:text-admiralty-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>
      <div
        data-testid="drawer-scroll"
        className="themed-scrollbar relative min-h-0 flex-1 overflow-y-auto py-4 pl-5 pr-2 text-sm [scrollbar-gutter:stable]"
      >
        {children}
      </div>
    </section>
  );
}
