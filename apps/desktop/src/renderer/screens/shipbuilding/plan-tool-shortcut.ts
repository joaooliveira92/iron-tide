import type { PlanTool } from "../../components/design-workspace/index.js";

const SHORTCUTS: Readonly<Record<string, Extract<PlanTool["mode"], "place" | "move">>> = {
  p: "place",
  m: "move",
};

/** The keys the plan tools answer to, for the hint beside the toolbar. */
export const PLAN_TOOL_HINT = "Plan tools (P places, M moves)";

const typingIn = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null);

/**
 * The tool a bare P or M key press selects, or null when the press is not a plan-tool shortcut. Pressing the active
 * tool's key turns it off, as its button does. Modified keys and typing in a field are never shortcuts.
 */
export function planToolShortcut(
  e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "target">,
  tool: PlanTool,
): PlanTool | null {
  if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return null;
  const mode = SHORTCUTS[e.key.toLowerCase()];
  if (mode === undefined) return null;
  return { ...tool, mode: tool.mode === mode ? "off" : mode };
}
