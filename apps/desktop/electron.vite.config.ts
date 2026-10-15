import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    // Same flag as the renderer's debug gate (ADR-0029); see src/main/debugGate.ts.
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
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react(), tailwindcss()],
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
