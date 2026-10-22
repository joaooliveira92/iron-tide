import { type ContentSchema, decodeStrictResult } from "../src/index.js";

export function decodeOk(schema: ContentSchema, data: unknown): boolean {
  return decodeStrictResult(schema, data)._tag === "Success";
}

export function decodeIssue(schema: ContentSchema, data: unknown): string {
  const result = decodeStrictResult(schema, data);
  return result._tag === "Failure" ? JSON.stringify(result.failure.issue) : "";
}
