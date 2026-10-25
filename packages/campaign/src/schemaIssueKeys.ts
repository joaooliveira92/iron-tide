import type { SchemaIssue } from "effect";

export interface IssueKeys {
  readonly missing: ReadonlySet<string>;
  readonly invalid: ReadonlySet<string>;
  readonly unexpected: ReadonlySet<string>;
}

export function issueKeys(issue: SchemaIssue.Issue): IssueKeys {
  const missing = new Set<string>();
  const invalid = new Set<string>();
  const unexpected = new Set<string>();
  const visit = (node: SchemaIssue.Issue, key: string | undefined, nested: boolean): void => {
    switch (node._tag) {
      case "Pointer": {
        const head = node.path[0];
        if (key === undefined) {
          visit(node.issue, head === undefined ? undefined : String(head), false);
        } else {
          visit(node.issue, key, true);
        }
        return;
      }
      case "Composite":
        for (const inner of node.issues) visit(inner, key, nested);
        return;
      case "AnyOf":
        if (key !== undefined) invalid.add(key);
        for (const inner of node.issues) visit(inner, key, nested);
        return;
      case "Filter":
      case "Encoding":
        visit(node.issue, key, nested);
        return;
      case "MissingKey":
        if (key !== undefined) (nested ? invalid : missing).add(key);
        return;
      case "UnexpectedKey":
        if (key !== undefined) unexpected.add(key);
        return;
      default:
        if (key !== undefined) invalid.add(key);
    }
  };
  visit(issue, undefined, false);
  return { missing, invalid, unexpected };
}

export function displayValue(value: unknown): string {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? "[object Object]"
    : String(value);
}

export function recordOf(value: object): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(value));
}
