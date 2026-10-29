import { createRoot } from "react-dom/client";

import { App } from "./shell/App.js";
import { GlobeAdapterHost } from "./components/globe-adapter/GlobeAdapterHost.js";
import { GlobeSpikeHost } from "./components/globe-spike/GlobeSpikeHost.js";
import { Toaster } from "./components/ui/toast.js";
import { installAppFlushListener } from "./lib/app-flush.js";
import { installRendererCrashHandlers } from "./lib/crash-report.js";
import { PreferencesProvider } from "./lib/preferences-context.js";
import { loadStartupSnapshot } from "./lib/startup-snapshot.js";
import { BackgroundProvider } from "./shell/BackgroundContext.js";
import { DensityProvider } from "./shell/DensityContext.js";
import { DisplayPreferencesProvider } from "./shell/display-preferences.js";
import { FontProvider } from "./shell/FontContext.js";
import { PreferencesResetNotice } from "./shell/PreferencesResetNotice.js";
import { ThemeProvider } from "./shell/ThemeContext.js";
import "./styles/globals.css";

installAppFlushListener();

installRendererCrashHandlers();

async function bootstrap(): Promise<void> {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element #root not found");
  }
  const startup = await loadStartupSnapshot(window.bluewave);
  createRoot(container).render(
    <PreferencesProvider initialSnapshot={startup?.preferences}>
      <ThemeProvider>
        <DisplayPreferencesProvider>
          <BackgroundProvider>
            <FontProvider>
              <DensityProvider>
                <GlobeAdapterHost />
                <GlobeSpikeHost>
                  <App initialWindowState={startup?.windowState} />
                </GlobeSpikeHost>
                <PreferencesResetNotice recovery={startup?.preferencesRecovery} />
                <Toaster />
              </DensityProvider>
            </FontProvider>
          </BackgroundProvider>
        </DisplayPreferencesProvider>
      </ThemeProvider>
    </PreferencesProvider>,
  );
}

void bootstrap();
