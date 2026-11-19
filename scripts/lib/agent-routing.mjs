const ALLOW = Object.freeze({ decision: "allow" });

export function evaluateAgentRouting({ input, policy }) {
  const requested =
    typeof input?.subagent_type === "string" && input.subagent_type !== ""
      ? input.subagent_type
      : policy.agentRoutingDefault;
  if (!policy.agentRoutingDenied.includes(requested)) return { ...ALLOW };
  return {
    decision: "block",
    message: `Agent subagent_type "${requested}" is denied by agent routing. Name a specialised agent: search (where things live), grep (call sites), audit (diff review), runner (gates and long tests), or Explore for a broad read-only sweep. Omitting subagent_type resolves to ${policy.agentRoutingDefault}.`,
  };
}

export function evaluateReadRouting({ input, policy }) {
  const file = typeof input?.file_path === "string" ? input.file_path.replaceAll("\\", "/") : "";
  if (file === "") return { ...ALLOW };
  const denied = policy.readDenyPatterns.some((pattern) => new RegExp(pattern, "u").test(file));
  if (!denied) return { ...ALLOW };
  if (
    Number.isInteger(input.limit) &&
    input.limit >= 1 &&
    input.limit <= policy.readRangeMaxLines
  ) {
    return { ...ALLOW };
  }
  return {
    decision: "block",
    message: `Full Read of ${file} is denied: the file is generated or large. Read a range with offset and limit (at most ${policy.readRangeMaxLines} lines), or search with \`rg -n -C3 <pattern> ${file} | head -${policy.readRangeMaxLines}\`.`,
  };
}
