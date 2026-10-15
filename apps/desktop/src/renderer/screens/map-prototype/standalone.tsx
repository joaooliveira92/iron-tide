/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Mounts the prototype screen on its own, outside the campaign shell. The
 * screen depends on no bridge, no session and no engine state — only the
 * fixture world — so the shell would add nothing but a login-shaped obstacle
 * between a reviewer and the three variants.
 *
 * The dev-only sidebar entry still exists for judging the map *inside* the
 * app chrome, which is the comparison that actually matters. This entry is for
 * the quick look.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../index.css";
import { MapPrototypeScreen } from "./MapPrototypeScreen.js";

const container = document.getElementById("root");
if (container !== null) {
  createRoot(container).render(
    <StrictMode>
      <div className="p-6 font-sans">
        <MapPrototypeScreen />
      </div>
    </StrictMode>,
  );
}
