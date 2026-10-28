import { createRoot } from "react-dom/client";

import { App } from "./shell/App.js";
import { GlobeAdapterHost } from "./components/globe-adapter/GlobeAdapterHost.js";
import { GlobeSpikeHost } from "./components/globe-spike/GlobeSpikeHost.js";
import { Toaster } from "./components/ui/toast.js";
import { installAppFlushListener } from "./lib/app-flush.js";
import { installRendererCrashHandlers } from "./lib/crash-report.js";
import { PreferencesProvider } from "./lib/preferences-context.js";
import { BackgroundProvider } from "./shell/BackgroundContext.js";
import { DensityProvider } from "./shell/DensityContext.js";
import { DisplayPreferencesProvider } from "./shell/display-preferences.js";
import { FontProvider } from "./shell/FontContext.js";
import { ThemeProvider } from "./shell/ThemeContext.js";
import "./styles/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

installAppFlushListener();

installRendererCrashHandlers();

createRoot(container).render(
  <PreferencesProvider>
    <ThemeProvider>
      <DisplayPreferencesProvider>
        <BackgroundProvider>
          <FontProvider>
            <DensityProvider>
              <GlobeAdapterHost />
              <GlobeSpikeHost>
                <App />
              </GlobeSpikeHost>
              <Toaster />
            </DensityProvider>
          </FontProvider>
        </BackgroundProvider>
      </DisplayPreferencesProvider>
    </ThemeProvider>
  </PreferencesProvider>,
);
