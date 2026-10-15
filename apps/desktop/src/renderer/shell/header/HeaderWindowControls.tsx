import { cn } from "../../lib/utils.js";
import { useWindowContext } from "../WindowContext.js";

const WINDOW_CONTROL_PATHS = {
  close:
    "M 0,0 0,0.7 4.3,5 0,9.3 0,10 0.7,10 5,5.7 9.3,10 10,10 10,9.3 5.7,5 10,0.7 10,0 9.3,0 5,4.3 0.7,0 Z",
  maximize: "M 0,0 0,10 10,10 10,0 Z M 1,1 9,1 9,9 1,9 Z",
  minimize: "M 0,5 10,5 10,6 0,6 Z",
} as const;

export function HeaderWindowControls() {
  const { platform, windowMinimize, windowMaximizeToggle, windowClose } = useWindowContext();

  // macOS draws its own window controls; the custom controls are only shown on
  // platforms that opt into them.
  if (platform === "darwin") return null;

  return (
    <div className="-mr-4 ml-2 flex self-stretch">
      <WindowControl
        label="minimize"
        svgPath={WINDOW_CONTROL_PATHS.minimize}
        onClick={windowMinimize}
      />
      <WindowControl
        label="maximize"
        svgPath={WINDOW_CONTROL_PATHS.maximize}
        onClick={windowMaximizeToggle}
      />
      <WindowControl
        label="close"
        svgPath={WINDOW_CONTROL_PATHS.close}
        onClick={windowClose}
        tone="destructive"
      />
    </div>
  );
}

function WindowControl({
  svgPath,
  label,
  onClick,
  tone = "default",
}: {
  readonly svgPath: string;
  readonly label: string;
  readonly onClick: () => void;
  readonly tone?: "default" | "destructive";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex w-11 items-center justify-center text-muted-foreground",
        tone === "destructive"
          ? "hover:bg-destructive hover:text-destructive-foreground"
          : "hover:bg-accent hover:text-accent-foreground",
      )}
      onClick={onClick}
    >
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path fill="currentColor" d={svgPath} />
      </svg>
    </button>
  );
}
