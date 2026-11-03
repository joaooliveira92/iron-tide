import { ConstructionProvider } from "./workspace/ConstructionContext.js";
import { ConstructionLayout } from "./workspace/ConstructionLayout.js";

export function ConstructionScreen({ sessionId }: { readonly sessionId: string }) {
  return (
    <ConstructionProvider sessionId={sessionId}>
      <ConstructionLayout />
    </ConstructionProvider>
  );
}
