import type { DesignDraft } from "@bluewave/ship-design";
import { useDesignState } from "../DesignWorkspaceContext.js";
import { DESIGN_WORKSPACE_REBUILD_HOST, RebuildPanelBody } from "./rebuild/RebuildPanelBody.js";

export function designDraftFrom(loaded: Record<string, unknown>): DesignDraft {
  return loaded as unknown as DesignDraft;
}

export function RebuildPanel({
  sessionId,
  onLoad,
  dirty,
}: {
  readonly sessionId?: string;
  readonly onLoad: (draft: DesignDraft) => void;
  readonly dirty: boolean;
}) {
  const { draft, content } = useDesignState();
  return (
    <RebuildPanelBody
      sessionId={sessionId}
      draft={draft}
      rules={content.rebuild}
      onLoad={(loaded) => onLoad(designDraftFrom(loaded))}
      dirty={dirty}
      host={DESIGN_WORKSPACE_REBUILD_HOST}
    />
  );
}
