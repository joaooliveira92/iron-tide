import type { JSX, ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { useSlideVisibility } from "./useSlideVisibility.js";

export interface SlidePanelProps {
  readonly isOpen: boolean;
  /**
   * `overlay` pins the panel to the bottom of its positioned parent and slides
   * it up (the nation dossier). `inline` keeps it in the page flow and eases it
   * in with a short rise (the preset detail panel).
   */
  readonly placement?: "overlay" | "inline";
  /** Ease in on first render instead of appearing already entered. */
  readonly animateOnMount?: boolean;
  readonly "aria-labelledby": string;
  readonly className?: string;
  readonly children: ReactNode;
}

const BASE = "ease-in transition-[transform,opacity] duration-500 motion-reduce:transition-none";

const PLACEMENT: Record<
  NonNullable<SlidePanelProps["placement"]>,
  { readonly base: string; readonly entered: string; readonly exited: string }
> = {
  overlay: {
    base: "absolute inset-x-0 bottom-0 z-30 max-h-[88dvh] origin-bottom overflow-y-auto overscroll-contain sm:max-h-[78dvh]",
    entered: "translate-y-0 opacity-100",
    exited: "pointer-events-none translate-y-full opacity-0",
  },
  inline: {
    base: "relative origin-top",
    entered: "translate-y-0 opacity-100",
    exited: "pointer-events-none translate-y-3 opacity-0",
  },
};

/**
 * The shared appear/disappear chrome for a panel that slides in: it owns the
 * mount lifecycle and the transition, and nothing about what is inside. The
 * nation dossier and the preset detail panel both wrap their own bodies in it.
 */
export function SlidePanel({
  isOpen,
  placement = "overlay",
  animateOnMount = false,
  "aria-labelledby": labelledBy,
  className,
  children,
}: SlidePanelProps): JSX.Element | null {
  const { mounted, entered } = useSlideVisibility(isOpen, animateOnMount);

  if (!mounted) return null;

  const classes = PLACEMENT[placement];
  return (
    <section
      aria-labelledby={labelledBy}
      aria-hidden={!isOpen}
      className={cn(BASE, classes.base, entered ? classes.entered : classes.exited, className)}
    >
      {children}
    </section>
  );
}
