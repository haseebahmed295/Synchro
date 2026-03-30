"use client";

/**
 * Sync Suggestions Panel Component
 * Displays bidirectional sync suggestions and allows users to accept/reject them
 * Requirements: 10.4, 10.5
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  DiagramSuggestion,
  RequirementSuggestion,
} from "@/lib/agents/architect";

interface SyncSuggestionsPanelProps {
  suggestions: (DiagramSuggestion | RequirementSuggestion)[];
  suggestionType: "diagram" | "requirement";
  artifactId: string;
  projectId: string;
  onSuggestionApplied: () => void;
}

export default function SyncSuggestionsPanel({
  suggestions,
  suggestionType,
  artifactId,
  projectId,
  onSuggestionApplied,
}: SyncSuggestionsPanelProps) {
  const [applying, setApplying] = useState<string | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(
    new Set(),
  );

  const handleApply = async (
    suggestion: DiagramSuggestion | RequirementSuggestion,
    index: number,
  ) => {
    const suggestionKey = `${index}`;
    setApplying(suggestionKey);

    try {
      const response = await fetch("/api/architect/apply-sync-suggestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          suggestion,
          suggestionType,
          artifactId,
          projectId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply suggestion");
      }

      // Mark as applied
      setAppliedSuggestions((prev) => new Set(prev).add(suggestionKey));

      // Notify parent component
      onSuggestionApplied();
    } catch (error) {
      console.error("Failed to apply suggestion:", error);
      alert(
        `Failed to apply suggestion: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setApplying(null);
    }
  };

  const handleReject = (index: number) => {
    const suggestionKey = `${index}`;
    setAppliedSuggestions((prev) => new Set(prev).add(suggestionKey));
  };

  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No sync suggestions available.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-lg font-semibold">
        {suggestionType === "diagram"
          ? "Diagram Update Suggestions"
          : "Requirement Suggestions"}
      </h3>

      {suggestions.map((suggestion, index) => {
        const suggestionKey = `${index}`;
        const isApplied = appliedSuggestions.has(suggestionKey);
        const isApplying = applying === suggestionKey;

        return (
          <div
            key={suggestionKey}
            className={`border rounded-lg p-4 ${
              isApplied ? "opacity-50 bg-gray-50" : "bg-white"
            }`}
          >
            {suggestionType === "diagram" ? (
              <DiagramSuggestionCard
                suggestion={suggestion as DiagramSuggestion}
              />
            ) : (
              <RequirementSuggestionCard
                suggestion={suggestion as RequirementSuggestion}
              />
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Confidence: {Math.round(suggestion.confidence * 100)}%
                </span>
                <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      suggestion.confidence > 0.7
                        ? "bg-green-500"
                        : suggestion.confidence > 0.5
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${suggestion.confidence * 100}%` }}
                  />
                </div>
              </div>

              {!isApplied && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(index)}
                    disabled={isApplying}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApply(suggestion, index)}
                    disabled={isApplying}
                  >
                    {isApplying ? "Applying..." : "Accept"}
                  </Button>
                </div>
              )}

              {isApplied && (
                <span className="text-sm text-green-600 font-medium">
                  ✓ Applied
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiagramSuggestionCard({
  suggestion,
}: {
  suggestion: DiagramSuggestion;
}) {
  const actionLabels = {
    add_node: "Add Node",
    remove_node: "Remove Node",
    add_edge: "Add Edge",
    remove_edge: "Remove Edge",
    update_node: "Update Node",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
          {actionLabels[suggestion.action]}
        </span>
        <span className="text-sm font-medium text-gray-700">
          {suggestion.target_id}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-2">{suggestion.reasoning}</p>

      {Object.keys(suggestion.data).length > 0 && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
          <div className="font-medium text-gray-700 mb-1">Changes:</div>
          <pre className="text-gray-600 overflow-x-auto">
            {JSON.stringify(suggestion.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function RequirementSuggestionCard({
  suggestion,
}: {
  suggestion: RequirementSuggestion;
}) {
  const actionLabels = {
    add_requirement: "Add Requirement",
    update_requirement: "Update Requirement",
    remove_requirement: "Remove Requirement",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
          {actionLabels[suggestion.action]}
        </span>
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
          {suggestion.type}
        </span>
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
          {suggestion.priority}
        </span>
      </div>

      <h4 className="text-sm font-semibold text-gray-900 mb-1">
        {suggestion.title}
      </h4>

      <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>

      <p className="text-xs text-gray-500 italic mb-2">
        {suggestion.reasoning}
      </p>

      {suggestion.affected_nodes.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-gray-500">Affected nodes: </span>
          <span className="text-xs text-gray-700">
            {suggestion.affected_nodes.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
