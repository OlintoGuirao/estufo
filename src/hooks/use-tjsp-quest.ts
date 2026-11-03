import { useCallback, useEffect, useState } from "react";
import { tjspQuestStore } from "@/services/tjsp-quest-store";
import { questPhaseAiStore } from "@/services/quest-phase-ai-store";
import type { QuestPlayerState } from "@/types/tjsp-quest";

export function useTjspQuest(): [QuestPlayerState, () => void] {
  const [state, setState] = useState(() => tjspQuestStore.get());
  const refresh = useCallback(() => setState(tjspQuestStore.get()), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all([tjspQuestStore.hydrate(), questPhaseAiStore.hydrate()]);
      if (!cancelled) setState(tjspQuestStore.get());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return [state, refresh];
}
