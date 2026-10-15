import type { ReactNode } from "react";
import { DEBUG_MODE } from "../../shell/debug-flag.js";
import { Kbd } from "../ui/kbd.js";

/**
 * The month + revision chips shown in a screen header — engine detail, so
 * debug builds only (ADR-0058). Returns `undefined` in release builds so the
 * header renders no actions slot at all.
 */
export function debugRevisionActions(
  month: { readonly month: number; readonly year: number } | null,
  revision: number,
): ReactNode {
  if (!DEBUG_MODE) return undefined;
  return (
    <div className="flex items-center gap-1.5">
      {month !== null && (
        <Kbd>
          {String(month.month).padStart(2, "0")}/{month.year}
        </Kbd>
      )}
      <Kbd>REV {revision}</Kbd>
    </div>
  );
}
