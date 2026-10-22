import { useMemo } from "react";
import {
  buildWorkshopView,
  type DesignDraft,
  type WorkshopEnvironment,
} from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { planModel } from "./planModel.js";
import { ProfileView } from "./ProfileView.js";

export function StarterProfile({
  draft,
  env,
  content,
  month,
}: {
  readonly draft: DesignDraft;
  readonly env: WorkshopEnvironment;
  readonly content: DrawingBoardContent;
  readonly month: string;
}) {
  const model = useMemo(
    () => planModel(draft, content, buildWorkshopView(draft, env), month),
    [draft, env, content, month],
  );
  return (
    <div aria-hidden="true" data-testid="starter-profile">
      <ProfileView
        draft={draft}
        content={content}
        sheerBp={model.form?.sheerBp ?? 10000}
        bow={model.frame.bow}
        stern={model.frame.stern}
        lcbPermille={model.frame.lcbPermille}
        superstructure={model.superstructure}
        facts={model.facts}
        mounts={model.visualMounts}
        look={model.look}
      />
    </div>
  );
}
