import { Anchor, Check } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { Button } from "../../components/ui/button.js";
import { GlassCard } from "../../components/ui/glass-card.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import { useWorldGenerationChecklist } from "./useWorldGenerationChecklist.js";
import { CHECKLIST_LINES } from "./world-generation-presentation.js";

export interface NewGameLaunchingScreenProps {
  readonly error: string | null;
  readonly onBackToReview: () => void;
}

export function NewGameLaunchingScreen({ error, onBackToReview }: NewGameLaunchingScreenProps) {
  const { revealedCount, flavorText } = useWorldGenerationChecklist(error === null);

  if (error !== null) {
    return (
      <NewGameScreenLayout size="sm" centered>
        <ScreenHeader
          icon={<Anchor className="h-5 w-5" />}
          title="Commissioning failed"
          description={error}
        />
        <Button type="button" variant="outline" onClick={onBackToReview}>
          Back to Commissioning Review
        </Button>
      </NewGameScreenLayout>
    );
  }

  return (
    <NewGameScreenLayout size="sm" centered>
      <ScreenHeader
        icon={<Anchor className="h-5 w-5" />}
        title="Establishing the Naval Order"
        description={flavorText}
        className="w-[34rem] max-w-full text-left"
      />
      <GlassCard glassVariant="liquid-refract" className="w-full">
        <ul className="flex flex-col gap-2 p-6 text-sm">
          {CHECKLIST_LINES.map((line, index) => {
            const revealed = index < revealedCount;
            return (
              <li
                key={line}
                data-revealed={revealed}
                aria-hidden={!revealed}
                className={cn(
                  "flex items-center gap-2 text-muted-foreground transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                  revealed ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
                )}
              >
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{line}</span>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </NewGameScreenLayout>
  );
}
