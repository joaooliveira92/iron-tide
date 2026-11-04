import { type ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export type NewGameScreenSize = "sm" | "md" | "lg";

export type NewGameScreenLayoutVariant = "panel" | "centered" | "bleed";

const SIZE_CLASSES: Record<NewGameScreenSize, string> = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
};

const OUTER_CLASSES: Record<NewGameScreenLayoutVariant, string> = {
  panel: "p-8",
  centered: "p-8 flex h-full flex-col",
  bleed: "flex min-h-full flex-col lg:h-full",
};

const INNER_CLASSES: Record<Exclude<NewGameScreenLayoutVariant, "bleed">, string> = {
  panel: "mx-auto flex w-full flex-col gap-6",
  centered: "mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 text-center",
};

export interface NewGameScreenLayoutProps {
  readonly variant?: NewGameScreenLayoutVariant;
  readonly size?: NewGameScreenSize;
  readonly className?: string;
  readonly children: ReactNode;
}

export function NewGameScreenLayout({
  variant = "panel",
  size = "lg",
  className,
  children,
}: NewGameScreenLayoutProps) {
  if (variant === "bleed") {
    return <div className={cn(OUTER_CLASSES.bleed, className)}>{children}</div>;
  }

  return (
    <div className={cn(OUTER_CLASSES[variant], className)}>
      <div className={cn(INNER_CLASSES[variant], SIZE_CLASSES[size])}>{children}</div>
    </div>
  );
}
