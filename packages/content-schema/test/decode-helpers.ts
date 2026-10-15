import { type ContentSchema, decodeStrictResult } from "../src/index.js";

/** True when `data` decodes strictly (unknown/excess keys rejected). */
export function decodeOk(schema: ContentSchema, data: unknown): boolean {
  return decodeStrictResult(schema, data)._tag === "Success";
}

/** A best-effort issue dump for failure messages; empty string on success. */
export function decodeIssue(schema: ContentSchema, data: unknown): string {
  const result = decodeStrictResult(schema, data);
  return result._tag === "Failure" ? JSON.stringify(result.failure.issue) : "";
}
