import { cpSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const GLOBE_SPIKE = process.env.VITE_BLUEWAVE_GLOBE_SPIKE === "true";
const GLOBE_ADAPTER = process.env.VITE_BLUEWAVE_GLOBE_ADAPTER === "true";

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
    plugins: [stubGlobeAdapter, react(), tailwindcss(), copyGlobeSpikeAssets],
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
