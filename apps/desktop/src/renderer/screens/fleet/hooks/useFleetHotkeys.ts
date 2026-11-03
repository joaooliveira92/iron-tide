import { useEffect, useRef } from "react";
import {
  classifyHotkeyTarget,
  fleetHotkeyAction,
  type FleetHotkeyAction,
} from "../fleet-hotkeys.js";

export type FleetHotkeyHandlers = Partial<Readonly<Record<FleetHotkeyAction, () => void>>>;

export function useFleetHotkeys(handlers: FleetHotkeyHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = fleetHotkeyAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
        target: classifyHotkeyTarget(event.target),
      });
      const handler = action === null ? undefined : latest.current[action];
      if (handler === undefined) return;
      event.preventDefault();
      handler();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
