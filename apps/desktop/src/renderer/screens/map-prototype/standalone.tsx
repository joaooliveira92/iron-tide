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
