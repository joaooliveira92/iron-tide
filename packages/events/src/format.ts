import type { ExplanationTree } from "./explanation.js";

function formatExplanationImpl(tree: ExplanationTree, indent: number): string {
  const prefix = "  ".repeat(indent);
  const lines: string[] = [];
  lines.push(
    `${prefix}${tree.formulaId} v${tree.formulaVersion} = ${String(tree.result)}${tree.unit === undefined ? "" : ` ${tree.unit}`}`,
  );

  const inputKeys = Object.keys(tree.inputs).sort();
  if (inputKeys.length > 0) {
    lines.push(`${prefix}  inputs:`);
    for (const key of inputKeys) lines.push(`${prefix}    ${key} = ${String(tree.inputs[key])}`);
  }

  const intermediateKeys = Object.keys(tree.intermediate).sort();
  if (intermediateKeys.length > 0) {
    lines.push(`${prefix}  intermediate:`);
    for (const key of intermediateKeys)
      lines.push(`${prefix}    ${key} = ${String(tree.intermediate[key])}`);
  }

  for (const child of tree.children ?? []) {
    lines.push(formatExplanationImpl(child, indent + 1));
  }
  return lines.join("\n");
}

export function formatExplanation(tree: ExplanationTree): string {
  return formatExplanationImpl(tree, 0);
}
