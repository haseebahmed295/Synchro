"use client";

/**
 * Requirements Client Component
 * Handles realtime subscriptions and requirement updates
 * Requirements: 17.2, 17.3, 25.2
 */

import { useCallback, useEffect, useState } from "react";
import RequirementsTable, {
  type Requirement,
} from "@/components/dashboard/requirements-table";
import { createRequirement, updateRequirement } from "@/lib/api/requirements";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { createClient } from "@/lib/supabase/client";

interface RequirementsClientProps {
  projectId: string;
  userId: string;
  initialRequirements: any[];
}

export default function RequirementsClient({
  projectId,
  userId,
  initialRequirements,
}: RequirementsClientProps) {
  const [requirements, setRequirements] = useState<Requirement[]>(() =>
    initialRequirements.map((artifact) => ({
      id: artifact.id,
      req_id: artifact.content.req_id,
      title: artifact.content.title,
      type: artifact.content.type,
      priority: artifact.content.priority,
      status: artifact.content.status,
    })),
  );
  const [pendingUpdates, setPendingUpdates] = useState<
    Map<string, { field: string; value: string }>
  >(new Map());
  const debouncedUpdates = useDebounce(pendingUpdates, 500);

  // Set up realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`requirements:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "artifacts",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (
            payload.eventType === "INSERT" &&
            payload.new.type === "requirement"
          ) {
            const newReq = {
              id: payload.new.id,
              req_id: payload.new.content.req_id,
              title: payload.new.content.title,
              type: payload.new.content.type,
              priority: payload.new.content.priority,
              status: payload.new.content.status,
            };
            setRequirements((prev) => [...prev, newReq]);
          } else if (
            payload.eventType === "UPDATE" &&
            payload.new.type === "requirement"
          ) {
            setRequirements((prev) =>
              prev.map((req) =>
                req.id === payload.new.id
                  ? {
                      id: payload.new.id,
                      req_id: payload.new.content.req_id,
                      title: payload.new.content.title,
                      type: payload.new.content.type,
                      priority: payload.new.content.priority,
                      status: payload.new.content.status,
                    }
                  : req,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setRequirements((prev) =>
              prev.filter((req) => req.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Process debounced updates
  useEffect(() => {
    if (debouncedUpdates.size === 0) return;

    const processUpdates = async () => {
      for (const [id, update] of debouncedUpdates.entries()) {
        try {
          await updateRequirement(id, update.field as any, update.value);
        } catch (error) {
          console.error("Failed to update requirement:", error);
        }
      }
      setPendingUpdates(new Map());
    };

    processUpdates();
  }, [debouncedUpdates]);

  // Handle requirement update
  const handleUpdate = useCallback(
    (id: string, field: string, value: string) => {
      // Optimistically update UI
      setRequirements((prev) =>
        prev.map((req) => (req.id === id ? { ...req, [field]: value } : req)),
      );

      // Queue debounced update
      setPendingUpdates((prev) => {
        const newMap = new Map(prev);
        newMap.set(id, { field, value });
        return newMap;
      });
    },
    [],
  );

  // Handle requirement creation
  const handleCreate = useCallback(async () => {
    try {
      await createRequirement(projectId, userId, {
        title: "New Requirement",
        description: "",
        type: "functional",
        priority: "medium",
        status: "draft",
      });
    } catch (error) {
      console.error("Failed to create requirement:", error);
    }
  }, [projectId, userId]);

  return (
    <RequirementsTable
      requirements={requirements}
      onUpdate={handleUpdate}
      onCreate={handleCreate}
    />
  );
}
