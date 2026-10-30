import { createRequire } from "node:module";
import { extname } from "node:path";

export const CONTENT_MODULE_EXTENSION = ".ts";

export type ContentModuleLoad =
  | { readonly ok: true; readonly document: unknown }
  | { readonly ok: false; readonly message: string };

export const isContentModulePath = (path: string): boolean =>
  extname(path) === CONTENT_MODULE_EXTENSION;

const requireModule = createRequire(import.meta.url);

export const loadContentModule = (absolutePath: string): ContentModuleLoad => {
  let loaded: unknown;
  try {
    loaded = requireModule(absolutePath);
  } catch (error) {
    return {
      ok: false,
      message: `content module failed to load: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const exported = (loaded as { readonly default?: unknown } | null)?.default;
  if (exported === undefined) {
    return {
      ok: false,
      message:
        "content module has no default export; export defineShipComponentCatalogue([...]) (or the matching define… helper)",
    };
  }
  if (typeof exported !== "object" || exported === null) {
    return { ok: false, message: "content module default export is not a document object" };
  }
  return { ok: true, document: exported };
};
