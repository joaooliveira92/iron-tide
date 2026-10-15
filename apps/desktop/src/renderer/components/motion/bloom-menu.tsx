"use client";
// beui.dev/components/blocks/bloom-menu

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

// Open panel dimensions, shared by the CSS sizing and the viewport clamp so
// the two never disagree. Width is `min(86vw, 420px)`, height a fixed 300px.
const PANEL_WIDTH_VW = 0.86;
const PANEL_MAX_WIDTH = 420;
const PANEL_HEIGHT = 300;

// Folder-open feel: a touch of overshoot as the panel expands, kept subtle.
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
  /** Label shown on the closed trigger and the open panel's header. */
  title?: string;
  /** Icon shown on the closed trigger, next to the title. */
  triggerIcon?: ComponentType<{ className?: string }>;
  /** Label of the item to mark as selected within the open panel. */
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

  // Track the trigger's screen position so the portaled panel (escaping any
  // clipped/z-indexed ancestor, e.g. the sidebar) can still center on it.
  // Clamp to the viewport: the panel is wider/taller than the trigger, so an
  // edge-anchored trigger would otherwise push it off-screen and clip it.
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
      {/* spacer fixes the anchor to the trigger size */}
      <div className="h-11 w-36" aria-hidden />

      {/* Centering box sized to the OPEN panel and centered on the trigger.
          place-items-center only centers an item that fits its cell, so the cell
          must be as wide as the panel — otherwise the overflow left-anchors and
          the panel expands rightward. The box is a fixed size per viewport (vw
          doesn't change mid-animation), so its -translate centering never drifts
          the way a content-sized wrapper would. Both states share its center, so
          the morph grows from the middle outward in every direction.

          Portaled to <body> and positioned with the measured trigger center so
          it always escapes ancestor stacking contexts (e.g. the sidebar), which
          a local z-index can't do once a parent establishes its own context. */}
      {anchor &&
        createPortal(
          <div
            ref={portalRef}
            style={{ left: anchor.x, top: anchor.y }}
            className="pointer-events-none fixed z-50 grid h-[300px] w-[min(86vw,420px)] -translate-x-1/2 -translate-y-1/2 place-items-center [&>*]:pointer-events-auto"
          >
            {/* popLayout pulls the exiting trigger out of grid flow at once, so the
                grid never briefly holds two rows and shoves the panel off-center */}
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
                    // `layout` lets framer undo the box's morph scaling so this
                    // content stays crisp instead of stretching with the resize.
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduce ? 0 : 0.12, duration: 0.2 }}
                  >
                    {/* header */}
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

                    {/* grid */}
                    <motion.div
                      // Iris reveal: start as a small box at the grid center and open
                      // outward to all four corners, so the menu grows from the middle
                      // in every direction instead of wiping top-down.
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
                        // Radial stagger: delay each item by its distance from the
                        // grid center so the four corners animate together and the
                        // open reads as center-out, not corner-by-corner.
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
                            // Static cell with hairline borders (no animated fill) so
                            // the grid lines never flicker as items stagger in. Only the
                            // inner content animates.
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
                  {/* own `layout` counter-scales the label so it stays crisp while the
                  button box morphs, instead of stretching with it */}
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
