import { cpSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const GLOBE_SPIKE = process.env.VITE_BLUEWAVE_GLOBE_SPIKE === "true";

const HARNESS_ONLY_FILES = new Set(["validation.json", "protected-resolution.json"]);

const copyGlobeSpikeAssets = {
  name: "bluewave-globe-spike-assets",
  closeBundle() {
    const source = resolve(__dirname, "map-spike-assets");
    if (!GLOBE_SPIKE || !existsSync(source)) return;
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
    plugins: [react(), tailwindcss(), copyGlobeSpikeAssets],
    define: {
      __GLOBE_SPIKE__: JSON.stringify(GLOBE_SPIKE),
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
