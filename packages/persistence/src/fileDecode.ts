import { readFileSync } from "node:fs";
import { Result, Schema } from "effect";
import {
  PointerFileSchema,
  SaveManifestSchema,
  SaveMetadataSchema,
  SigFileSchema,
} from "./schemas.js";

const STRICT_DECODE_OPTIONS = { onExcessProperty: "error" } as const;

function jsonFileReader<A>(schema: Schema.ConstraintDecoder<A, never>): (path: string) => A | null {
  const decode = Schema.decodeUnknownResult(Schema.fromJsonString(schema), STRICT_DECODE_OPTIONS);
  return (path) => {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      return null;
    }
    const decoded = decode(text);
    return Result.isSuccess(decoded) ? decoded.success : null;
  };
}

export const readPointerFile = jsonFileReader(PointerFileSchema);
export const readSaveMetadata = jsonFileReader(SaveMetadataSchema);
export const readSigFile = jsonFileReader(SigFileSchema);
export const readSaveManifest = jsonFileReader(SaveManifestSchema);
