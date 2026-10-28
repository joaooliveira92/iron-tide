import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { basename, extname, resolve, sep } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const GLOBE_SPIKE = process.env.VITE_BLUEWAVE_GLOBE_SPIKE === "true";
const GLOBE_ADAPTER = process.env.VITE_BLUEWAVE_GLOBE_ADAPTER !== "false";

const HARNESS_ONLY_FILES = new Set(["validation.json", "protected-resolution.json"]);

const stubGlobeAdapter = {
  name: "bluewave-globe-adapter-stub",
  enforce: "pre" as const,
  resolveId(source: string, importer: string | undefined) {
    if (GLOBE_ADAPTER) return null;
    if (source !== "./GlobeAdapter.js" || importer === undefined) return null;
    if (!importer.includes("/components/globe-adapter/")) return null;
    return resolve(__dirname, "src/renderer/components/globe-adapter/GlobeAdapterStub.ts");
  },
};

const MAP_ASSET_CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".bwtp": "application/octet-stream",
  ".pbf": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

const copyGlobeRuntimeAssets = {
  name: "bluewave-globe-runtime-assets",
  closeBundle() {
    if (!GLOBE_ADAPTER) return;
    const source = resolve(__dirname, "map-assets");
    if (!existsSync(source)) {
      throw new Error(
        `Globe runtime assets are missing at ${source}. Restore apps/desktop/map-assets before the production build.`,
      );
    }
    cpSync(source, resolve(__dirname, "out/renderer/map-assets"), {
      recursive: true,
      filter: (path) => !HARNESS_ONLY_FILES.has(basename(path)),
    });
  },
};

const copyGlobeSpikeAssets = {
  name: "bluewave-globe-spike-assets",
  closeBundle() {
    const source = resolve(__dirname, "map-spike-assets");
    if (!(GLOBE_SPIKE || GLOBE_ADAPTER) || !existsSync(source)) return;
    cpSync(source, resolve(__dirname, "out/renderer/map-spike"), {
      recursive: true,
      filter: (path) => !HARNESS_ONLY_FILES.has(basename(path)),
    });
  },
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __BLUEWAVE_DEBUG__: JSON.stringify(process.env.VITE_BLUEWAVE_DEBUG === "true"),
    },
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
        external: ["electron", "electron-devtools-installer"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
        external: ["electron"],
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [
      stubGlobeAdapter,
      react(),
      tailwindcss(),
      {
        name: "bluewave-globe-runtime-assets-dev",
        configureServer(server) {
          if (!GLOBE_ADAPTER) return;
          const root = resolve(__dirname, "map-assets");
          server.middlewares.use((request, response, next) => {
            const pathname = (request.url ?? "").split("?")[0] ?? "";
            if (!pathname.startsWith("/map-assets/")) {
              next();
              return;
            }
            let relative: string;
            try {
              relative = decodeURIComponent(pathname.slice("/map-assets/".length));
            } catch {
              next();
              return;
            }
            const file = resolve(root, relative);
            if (!file.startsWith(`${root}${sep}`)) {
              next();
              return;
            }
            let size: number;
            try {
              const stats = statSync(file);
              if (!stats.isFile()) {
                next();
                return;
              }
              size = stats.size;
            } catch {
              next();
              return;
            }
            response.setHeader(
              "Content-Type",
              MAP_ASSET_CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
            );
            response.setHeader("Content-Length", size);
            createReadStream(file).pipe(response);
          });
        },
      },
      copyGlobeRuntimeAssets,
      copyGlobeSpikeAssets,
    ],
    define: {
      __GLOBE_SPIKE__: JSON.stringify(GLOBE_SPIKE),
      __GLOBE_ADAPTER__: JSON.stringify(GLOBE_ADAPTER),
    },
    build: {
      outDir: resolve(__dirname, "out/renderer"),
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer"),
      },
    },
  },
});
