import type { LucideIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface ScreenHeaderSpec {
  readonly title: string;
  readonly icon?: LucideIcon | undefined;
}

interface ScreenHeaderContextValue {
  readonly spec: ScreenHeaderSpec | null;
  readonly toolbarUsed: boolean;
  readonly toolbarTarget: HTMLElement | null;
  readonly setSpec: (spec: ScreenHeaderSpec | null) => void;
  readonly setToolbarUsed: (used: boolean) => void;
  readonly setToolbarTarget: (target: HTMLElement | null) => void;
}

const ScreenHeaderContext = createContext<ScreenHeaderContextValue | null>(null);

export function ScreenHeaderProvider({ children }: { readonly children: ReactNode }) {
  const [spec, setSpec] = useState<ScreenHeaderSpec | null>(null);
  const [toolbarUsed, setToolbarUsed] = useState(false);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const value = useMemo(
    () => ({ spec, toolbarUsed, toolbarTarget, setSpec, setToolbarUsed, setToolbarTarget }),
    [spec, toolbarUsed, toolbarTarget],
  );
  return <ScreenHeaderContext.Provider value={value}>{children}</ScreenHeaderContext.Provider>;
}

export function useScreenHeaderHost(): boolean {
  const context = useContext(ScreenHeaderContext);
  return context !== null && context.toolbarTarget !== null;
}

export function useScreenHeaderSlot(): {
  readonly spec: ScreenHeaderSpec | null;
  readonly toolbarUsed: boolean;
  readonly bindToolbar: (target: HTMLElement | null) => void;
} {
  const context = useContext(ScreenHeaderContext);
  return {
    spec: context?.spec ?? null,
    toolbarUsed: context?.toolbarUsed ?? false,
    bindToolbar: context?.setToolbarTarget ?? NOOP_BIND,
  };
}

const NOOP_BIND = (): void => undefined;

export interface ScreenHeaderProps extends ScreenHeaderSpec {
  readonly children?: ReactNode;
}

export function ScreenHeader({ title, icon, children }: ScreenHeaderProps) {
  const context = useContext(ScreenHeaderContext);
  const setSpec = context?.setSpec;
  const setToolbarUsed = context?.setToolbarUsed;
  const hasToolbar = children !== undefined && children !== null && children !== false;

  useLayoutEffect(() => {
    setSpec?.({ title, icon });
    return () => setSpec?.(null);
  }, [setSpec, title, icon]);

  useLayoutEffect(() => {
    setToolbarUsed?.(hasToolbar);
    return () => setToolbarUsed?.(false);
  }, [setToolbarUsed, hasToolbar]);

  if (!hasToolbar || context?.toolbarTarget == null) return null;
  return createPortal(children, context.toolbarTarget);
}
