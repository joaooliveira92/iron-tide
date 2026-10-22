import { isDebugMode } from "./debug-mode.js";

export const DEBUG_MODE = isDebugMode({ flag: import.meta.env.VITE_BLUEWAVE_DEBUG });
