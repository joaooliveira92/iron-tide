import { type ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export type NewGameScreenSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<NewGameScreenSize, string> = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
};

export interface NewGameScreenLayoutProps {
  readonly size?: NewGameScreenSize;
  readonly centered?: boolean;
  readonly fullBleed?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

export function NewGameScreenLayout({
  size = "lg",
  centered = false,
  fullBleed = false,
  className,
  children,
}: NewGameScreenLayoutProps) {
  if (fullBleed) {
    return <div className={cn("flex min-h-full flex-col lg:h-full", className)}>{children}</div>;
  }

  return (
    <div className={cn("p-8", centered && "flex h-full flex-col", className)}>
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6",
          SIZE_CLASSES[size],
          centered && "flex-1 items-center justify-center text-center",
        )}
      >
        {children}
      </div>
    </div>
  );
}
