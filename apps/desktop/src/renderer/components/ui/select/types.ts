import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";

export type Placement = "bottom" | "top";
export type SelectValue = string | null;
export type InitialActiveDirection = "first" | "last" | "selected";

export interface SelectOptionRecord {
  id: string;
  value: string;
  label: string;
  icon?: ReactNode;
  disabled: boolean;
  ref: RefObject<HTMLElement | null>;
}

export interface FloatingPosition {
  left: number;
  width: number;
  anchorTop: number;
  anchorBottom: number;
  availableHeight: number;
}

export interface SelectState {
  value: SelectValue;
  activeValue: SelectValue;
  open: boolean;
  disabled: boolean;
  required: boolean;
  placement: Placement;
}

export interface SelectActions {
  registerOption: (option: SelectOptionRecord) => void;
  unregisterOption: (id: string) => void;
  setActiveValue: (value: SelectValue) => void;
  setOpen: (open: boolean) => void;
  selectValue: (value: string) => void;
  setPlacement: (placement: Placement) => void;
  handleTriggerKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

export interface SelectMeta {
  reduceMotion: boolean;
  triggerId: string;
  listboxId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  floatingRef: RefObject<HTMLDivElement | null>;
  getOptions: () => SelectOptionRecord[];
  getOptionByValue: (value: SelectValue) => SelectOptionRecord | undefined;
}

export interface SelectContextValue {
  state: SelectState;
  actions: SelectActions;
  meta: SelectMeta;
}
