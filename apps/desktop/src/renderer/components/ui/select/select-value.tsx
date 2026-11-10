"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useSelectContext } from "./context.js";

export interface SelectValueProps {
  placeholder?: ReactNode;
  className?: string;
}

export function SelectValue({ placeholder = "Select", className }: SelectValueProps) {
  const { state, meta } = useSelectContext("SelectValue");

  const selectedOption = meta.getOptionByValue(state.value);

  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 text-left",
        selectedOption ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {selectedOption?.icon !== undefined ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center">
          {selectedOption.icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{selectedOption?.label ?? placeholder}</span>
    </span>
  );
}
