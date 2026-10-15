import { useEffect, useState } from "react";
import { decodeCoastline } from "../../lib/coastline-codec.js";
import type { FlatPolygon } from "../../lib/simplify-geometry.js";

/**
 * Decodes the baked coastline (coastline-data.ts, see bake-coastline.ts) once
 * and shares it across every map instance. Synchronous work is deferred to an
 * effect so the map shell paints first.
 */
let decoded: readonly FlatPolygon[] | null = null;

function load(): Promise<readonly FlatPolygon[]> {
  return import("./coastline-data.js").then(({ COASTLINE_BASE64 }) => {
    if (decoded === null) {
      const binary = atob(COASTLINE_BASE64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      decoded = decodeCoastline(bytes.buffer);
    }
    return decoded;
  });
}

export type CoastlineState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly polygons: readonly FlatPolygon[] }
  | { readonly status: "error"; readonly message: string };

export function useCoastline(): CoastlineState {
  const [state, setState] = useState<CoastlineState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    load().then(
      (polygons) => {
        if (active) setState({ status: "ready", polygons });
      },
      (error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Coastline failed to load",
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
