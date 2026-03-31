"use client";

/**
 * Requirements Client Component
 * Handles realtime subscriptions and requirement updates
 * Requirements: 17.2, 17.3, 25.2, 10.1, 10.3, 10.4, 10.5
 */

import { useCallback, useEffect, useState } from "react";
import RequirementsTable, {
  type Requirement,
} from "@/components/dashboard/requirements-table";
import {
  RequirementDetailsDialog,
  type RequirementDetails,
} from "@/components/dashboard/requirement-details-dialog";
import { TextToRequirementsDialog } from "@/components/dashboard/text-to-requirements-dialog";
import SyncSuggestionsPanel from "@/components/dashboard/sync-suggestions-panel";
import { Button } from "@/components/ui/button";
import type { DiagramSuggestion } from "@/lib/agents/architect";
import type { JSONPatch } from "@/lib/agents/json-patch";
import { createRequirement, updateRequirement, deleteRequirement } from "@/lib/api/requirements";
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
      description: artifact.content.description || "",
      links: artifact.content.links || [],
      tags: artifact.content.metadata?.tags || [],
    })),
  );
  const [pendingUpdates, setPendingUpdates] = useState<
    Map<string, { field: string; value: string }>
  >(new Map());
  const debouncedUpdates = useDebounce(pendingUpdates, 500);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<DiagramSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(
    null,
  );
  const [diagrams, setDiagrams] = useState<any[]>([]);
  const [editingRequirement, setEditingRequirement] =
    useState<RequirementDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showTextToRequirementsDialog, setShowTextToRequirementsDialog] =
    useState(false);
  const [isGeneratingRequirements, setIsGeneratingRequirements] =
    useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Set up realtime subscription
  useEffect(() => {
    const supabase = createClient();

    console.log("[Realtime] Setting up subscription for project:", projectId);

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
          console.log("[Realtime] Received event:", payload.eventType, (payload.new as any)?.type);
          if (
            payload.eventType === "INSERT" &&
            (payload.new as any).type === "requirement"
          ) {
            const newReq = {
              id: payload.new.id,
              req_id: payload.new.content.req_id,
              title: payload.new.content.title,
              type: payload.new.content.type,
              priority: payload.new.content.priority,
              status: payload.new.content.status,
              description: payload.new.content.description || "",
              links: payload.new.content.links || [],
              tags: payload.new.content.metadata?.tags || [],
            };
            console.log("[Realtime] Adding new requirement:", newReq.title);
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
                      description: payload.new.content.description || "",
                      links: payload.new.content.links || [],
                      tags: payload.new.content.metadata?.tags || [],
                    }
                  : req,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setRequirements((prev) =>
              prev.filter((req) => req.id !== payload.old.id),
            );
          } else if (
            payload.eventType === "INSERT" &&
            payload.new.type === "diagram"
          ) {
            setDiagrams((prev) => [...prev, payload.new]);
          }
        },
      )
      .subscribe();

    console.log("[Realtime] Subscription status:", channel.state);

    // Fetch diagrams for the project
    supabase
      .from("artifacts")
      .select("id, content")
      .eq("project_id", projectId)
      .eq("type", "diagram")
      .then(({ data }) => {
        if (data) {
          setDiagrams(data);
          if (data.length > 0) {
            setSelectedDiagramId(data[0].id);
          }
        }
      });

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
    console.log("Creating requirement for project:", projectId, "user:", userId);
    try {
      const result = await createRequirement(projectId, userId, {
        title: "New Requirement",
        description: "",
        type: "functional",
        priority: "medium",
        status: "draft",
      });
      console.log("Requirement created successfully:", result);
      
      // Optimistically add to UI (realtime will also update, but this is faster)
      const newReq = {
        id: result.id,
        req_id: result.content.req_id,
        title: result.content.title,
        type: result.content.type,
        priority: result.content.priority,
        status: result.content.status,
        description: result.content.description || "",
        links: result.content.links || [],
        tags: result.content.metadata?.tags || [],
      };
      setRequirements((prev) => [...prev, newReq]);
    } catch (error) {
      console.error("Failed to create requirement:", error);
      alert(`Failed to create requirement: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  }, [projectId, userId]);

  // Handle opening requirement details dialog
  const handleEditDetails = useCallback((requirement: Requirement) => {
    setEditingRequirement(requirement as RequirementDetails);
    setShowDetailsDialog(true);
  }, []);

  // Handle saving requirement details
  const handleSaveDetails = useCallback(
    async (updatedRequirement: RequirementDetails) => {
      try {
        const supabase = createClient();

        // Fetch current requirement
        const { data: current, error: fetchError } = await supabase
          .from("artifacts")
          .select("content, version")
          .eq("id", updatedRequirement.id)
          .single();

        if (fetchError) throw fetchError;

        // Update the full content
        const updatedContent = {
          ...current.content,
          title: updatedRequirement.title,
          description: updatedRequirement.description,
          type: updatedRequirement.type,
          priority: updatedRequirement.priority,
          status: updatedRequirement.status,
          links: updatedRequirement.links || [],
          metadata: {
            ...current.content.metadata,
            tags: updatedRequirement.tags || [],
          },
        };

        const { error: updateError } = await supabase
          .from("artifacts")
          .update({
            content: updatedContent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", updatedRequirement.id)
          .eq("version", current.version);

        if (updateError) throw updateError;

        // Optimistically update UI
        setRequirements((prev) =>
          prev.map((req) =>
            req.id === updatedRequirement.id ? updatedRequirement : req,
          ),
        );
      } catch (error) {
        console.error("Failed to update requirement:", error);
        alert(
          `Failed to update requirement: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [],
  );

  // Handle requirement deletion
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteRequirement(id);
      // Optimistically update UI
      setRequirements((prev) => prev.filter((req) => req.id !== id));
    } catch (error) {
      console.error("Failed to delete requirement:", error);
      alert(
        `Failed to delete requirement: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }, []);

  // Handle text to requirements conversion success
  const handleTextConversionSuccess = useCallback(() => {
    // The realtime subscription will automatically update the UI
    // No need to manually refresh
  }, []);

  // Handle requirement created from SSE stream
  const handleRequirementCreated = useCallback((artifact: any) => {
    const newReq = {
      id: artifact.id,
      req_id: artifact.content.id,
      title: artifact.content.title,
      type: artifact.content.type,
      priority: artifact.content.priority,
      status: artifact.content.status,
      description: artifact.content.description || "",
      links: artifact.content.links || [],
      tags: artifact.content.metadata?.tags || [],
    };
    
    console.log("[UI] Adding requirement from SSE:", newReq.title);
    setRequirements((prev) => {
      // Check if already exists (avoid duplicates from realtime)
      if (prev.some(r => r.id === newReq.id)) {
        return prev;
      }
      return [...prev, newReq];
    });
    
    // Update progress
    setGenerationProgress((prev) => prev + 1);
  }, []);

  // Handle generation start
  const handleGenerationStart = useCallback(() => {
    setIsGeneratingRequirements(true);
    setGenerationProgress(0);
  }, []);

  // Handle generation complete
  const handleGenerationComplete = useCallback(() => {
    setIsGeneratingRequirements(false);
    setGenerationProgress(0);
  }, []);

  // Generate diagram suggestions from requirement changes (Requirement 10.1, 10.3)
  const handleGenerateSuggestions = useCallback(async () => {
    if (!selectedDiagramId) {
      alert("Please select a diagram first");
      return;
    }

    // Create a simple JSON patch representing the last change
    // In a real implementation, you'd track actual changes
    const samplePatch: JSONPatch = {
      op: "replace",
      path: "/requirements/0/title",
      value: "Updated requirement",
    };

    setLoadingSuggestions(true);
    try {
      const response = await fetch("/api/architect/suggest-diagram-updates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirementDelta: samplePatch,
          diagramId: selectedDiagramId,
          projectId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate suggestions");
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
      alert(
        `Failed to generate suggestions: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoadingSuggestions(false);
    }
  }, [selectedDiagramId, projectId]);

  // Handle suggestion applied (Requirement 10.5)
  const handleSuggestionApplied = useCallback(() => {
    // Refresh suggestions or close panel
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        {/* AI Generation Progress Banner */}
        {isGeneratingRequirements && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  AI is generating requirements...
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {generationProgress > 0
                    ? `${generationProgress} requirement${generationProgress !== 1 ? "s" : ""} created so far`
                    : "Analyzing your text and extracting requirements"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Requirements</h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowTextToRequirementsDialog(true)}
              size="sm"
              variant="outline"
            >
              Convert Text to Requirements
            </Button>
            {diagrams.length > 0 && (
              <>
                <select
                  value={selectedDiagramId || ""}
                  onChange={(e) => setSelectedDiagramId(e.target.value)}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="">Select diagram...</option>
                  {diagrams.map((diagram) => (
                    <option key={diagram.id} value={diagram.id}>
                      {diagram.content?.diagram_metadata?.name ||
                        `Diagram ${diagram.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleGenerateSuggestions}
                  disabled={loadingSuggestions || !selectedDiagramId}
                  size="sm"
                  variant="outline"
                >
                  {loadingSuggestions
                    ? "Analyzing..."
                    : "Sync to Diagram"}
                </Button>
              </>
            )}
          </div>
        </div>
        <RequirementsTable
          requirements={requirements}
          onUpdate={handleUpdate}
          onCreate={handleCreate}
          onEditDetails={handleEditDetails}
          onDelete={handleDelete}
        />
      </div>

      {/* Requirement details dialog */}
      <RequirementDetailsDialog
        requirement={editingRequirement}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        onSave={handleSaveDetails}
      />

      {/* Text to requirements dialog */}
      <TextToRequirementsDialog
        projectId={projectId}
        open={showTextToRequirementsDialog}
        onOpenChange={setShowTextToRequirementsDialog}
        onSuccess={handleTextConversionSuccess}
        onRequirementCreated={handleRequirementCreated}
        onGenerationStart={handleGenerationStart}
        onGenerationComplete={handleGenerationComplete}
      />

      {/* Sync suggestions panel */}
      {showSuggestions && selectedDiagramId && (
        <div className="w-96 flex-shrink-0 overflow-y-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Sync Suggestions
            </h3>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              ✕
            </button>
          </div>
          <SyncSuggestionsPanel
            suggestions={suggestions}
            suggestionType="diagram"
            artifactId={selectedDiagramId}
            projectId={projectId}
            onSuggestionApplied={handleSuggestionApplied}
          />
        </div>
      )}
    </div>
  );
}
