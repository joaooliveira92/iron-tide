import { createContext, memo, useContext, type ReactNode } from "react";

import { WORLD_WRAP_TURNS } from "../projection.js";
import { useWorldMapScene } from "./WorldMapScene.js";

const WorldTurnContext = createContext(0);

export function useWorldTurn(): number {
  return useContext(WorldTurnContext);
}

export const WorldCopies = memo(function WorldCopies({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { width } = useWorldMapScene().meta;
  return (
    <>
      {WORLD_WRAP_TURNS.map((turn) => (
        <g
          key={turn}
          transform={`translate(${turn * width} 0)`}
          style={turn === 0 ? undefined : { display: "var(--map-copies, inline)" }}
        >
          <WorldTurnContext.Provider value={turn}>{children}</WorldTurnContext.Provider>
        </g>
      ))}
    </>
  );
});
