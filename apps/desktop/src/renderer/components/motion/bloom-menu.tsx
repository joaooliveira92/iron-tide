"use client";

import { Bell, FileText, FolderClosed, LayoutGrid, Link, Plus, Table, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ComponentType, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EASE_OUT } from "../../lib/ease.js";
import { cn } from "../../lib/utils.js";

type MenuItem = { label: string; icon: ComponentType<{ className?: string }> };

const ITEMS: MenuItem[] = [
  { label: "Doc", icon: FileText },
  { label: "Board", icon: LayoutGrid },
  { label: "Table", icon: Table },
  { label: "Folder", icon: FolderClosed },
  { label: "Reminder", icon: Bell },
  { label: "Link", icon: Link },
];

const PANEL_WIDTH_VW = 0.86;
const PANEL_MAX_WIDTH = 420;
const PANEL_HEIGHT = 300;

const SPRING_FOLDER = {
  type: "spring",
  stiffness: 300,
  damping: 32,
  mass: 0.9,
} as const;

export interface BloomMenuProps {
  items?: MenuItem[];
  onSelect?: (label: string) => void;
  className?: string;
  title?: string;
  triggerIcon?: ComponentType<{ className?: string }>;
  selected?: string;
}

export function BloomMenu({
  items = ITEMS,
  onSelect,
  className,
  title = "Create",
  triggerIcon: TriggerIcon = Plus,
  selected,
}: BloomMenuProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const layoutId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !portalRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const gutter = 8;
      const halfW = Math.min(window.innerWidth * PANEL_WIDTH_VW, PANEL_MAX_WIDTH) / 2;
      const halfH = PANEL_HEIGHT / 2;
      setAnchor({
        x: Math.min(
          Math.max(rect.left + rect.width / 2, gutter + halfW),
          window.innerWidth - gutter - halfW,
        ),
        y: Math.min(
          Math.max(rect.top + rect.height / 2, gutter + halfH),
          window.innerHeight - gutter - halfH,
        ),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  const morph = reduce ? { duration: 0.15 } : SPRING_FOLDER;

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <div className="h-11 w-36" aria-hidden />

      {anchor &&
        createPortal(
          <div
            ref={portalRef}
            style={{ left: anchor.x, top: anchor.y }}
            className="pointer-events-none fixed z-50 grid h-[300px] w-[min(86vw,420px)] -translate-x-1/2 -translate-y-1/2 place-items-center [&>*]:pointer-events-auto"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {open ? (
                <motion.div
                  key="panel"
                  layoutId={layoutId}
                  transition={morph}
                  style={{ borderRadius: 16 }}
                  className="w-[min(86vw,420px)] overflow-hidden border border-border bg-card"
                >
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduce ? 0 : 0.12, duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground">{title}</span>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close menu"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <motion.div
                      initial={reduce ? false : { clipPath: "inset(45% 34% 45% 34%)" }}
                      animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                      transition={{
                        delay: reduce ? 0 : 0.08,
                        duration: 0.45,
                        ease: EASE_OUT,
                      }}
                      className="grid grid-cols-3"
                    >
                      {items.map((item, i) => {
                        const cols = 3;
                        const rows = Math.ceil(items.length / cols);
                        const col = i % cols;
                        const row = Math.floor(i / cols);
                        const dist = Math.hypot(col - (cols - 1) / 2, row - (rows - 1) / 2);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              onSelect?.(item.label);
                              setOpen(false);
                            }}
                            aria-pressed={item.label === selected}
                            className={cn(
                              "flex items-center justify-center px-3 py-6 text-muted-foreground transition-colors hover:text-foreground",
                              item.label === selected && "text-foreground",
                              i % 3 !== 2 && "border-r border-border",
                              i < 3 && "border-b border-border",
                            )}
                          >
                            <motion.span
                              initial={
                                reduce
                                  ? { opacity: 0 }
                                  : {
                                      opacity: 0,
                                      scale: 0.85,
                                      filter: "blur(6px)",
                                    }
                              }
                              animate={{
                                opacity: 1,
                                scale: 1,
                                filter: "blur(0px)",
                              }}
                              transition={{
                                delay: reduce ? 0 : 0.1 + dist * 0.07,
                                type: "spring",
                                stiffness: 440,
                                damping: 34,
                              }}
                              className="flex flex-col items-center gap-2"
                            >
                              <item.icon className="h-5 w-5" />
                              <span className="text-sm font-medium">{item.label}</span>
                            </motion.span>
                          </button>
                        );
                      })}
                    </motion.div>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.button
                  key="trigger"
                  type="button"
                  layoutId={layoutId}
                  transition={morph}
                  style={{ borderRadius: 16 }}
                  onClick={() => setOpen(true)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  {...(reduce ? {} : { whileTap: { scale: 0.97 } })}
                  className="inline-flex h-11 w-36 items-center justify-center border border-border bg-card text-sm font-medium text-foreground"
                >
                  <motion.span layout className="inline-flex items-center gap-2 whitespace-nowrap">
                    {title}
                    <TriggerIcon className="h-4 w-4" />
                  </motion.span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </div>
  );
}
