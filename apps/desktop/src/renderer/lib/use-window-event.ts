import { useRef } from "react";

import { useLifecycle } from "../shell/useExternalSync.js";

export function useWindowEvent<Type extends keyof WindowEventMap>(
  type: Type,
  handler: (event: WindowEventMap[Type]) => void,
  options?: boolean | AddEventListenerOptions,
): void {
  const latest = useRef(handler);
  latest.current = handler;
  const capture = typeof options === "boolean" ? options : options?.capture === true;
  const passive = typeof options === "object" ? options.passive : undefined;
  useLifecycle(() => {
    const listener = (event: WindowEventMap[Type]): void => latest.current(event);
    const listenerOptions: AddEventListenerOptions = { capture };
    if (passive !== undefined) listenerOptions.passive = passive;
    window.addEventListener(type, listener, listenerOptions);
    return () => window.removeEventListener(type, listener, listenerOptions);
  }, [type, capture, passive]);
}
