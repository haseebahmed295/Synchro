/**
 * Hook: usePipelineTrigger
 * Debounced trigger for the AI pipeline after user edits.
 * Call `trigger(artifactId, projectId)` after any user save —
 * it waits 2s of inactivity before firing so rapid edits batch together.
 */

import { useCallback, useRef } from "react";

export function usePipelineTrigger() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback((artifactId: string, projectId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/pipeline/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId, projectId }),
        });
      } catch (err) {
        console.error("[pipeline-trigger] Failed:", err);
      }
    }, 2000);
  }, []);

  return { trigger };
}
