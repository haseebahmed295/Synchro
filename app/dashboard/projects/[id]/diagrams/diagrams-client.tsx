'use client';

/**
 * Diagrams Client Component
 * Client-side diagram management with React Flow canvas
 * Optimized with debouncing and performance enhancements
 * Requirements: 9.1, 9.2, 26.1, 26.2, 26.3
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DiagramCanvas } from '@/components/dashboard/diagram-canvas';
import type { DiagramNode, DiagramEdge, Diagram } from '@/lib/types/diagram';

// Debounce delay for database updates (ms) - Requirement 9.4
const UPDATE_DEBOUNCE_DELAY = 500;

interface DiagramsClientProps {
  projectId: string;
  initialDiagrams: Diagram[];
}

export function DiagramsClient({ projectId, initialDiagrams }: DiagramsClientProps) {
  const [diagrams, setDiagrams] = useState<Diagram[]>(initialDiagrams);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(
    initialDiagrams[0]?.id || null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Debounce timer refs for performance optimization (Requirement 26.2)
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<{ diagramId: string; diagram: Diagram } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Get selected diagram
  const selectedDiagram = useMemo(
    () => diagrams.find((d) => d.id === selectedDiagramId) || null,
    [diagrams, selectedDiagramId]
  );

  // Subscribe to real-time updates (Requirement 17.2, 17.3)
  useEffect(() => {
    const channel = supabase
      .channel(`diagrams:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'artifacts',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const artifact = payload.new;
            if (artifact.type === 'diagram') {
              setDiagrams((prev) => {
                const exists = prev.find((d) => d.id === artifact.id);
                if (exists) {
                  return prev.map((d) =>
                    d.id === artifact.id ? parseDiagramArtifact(artifact) : d
                  );
                }
                return [...prev, parseDiagramArtifact(artifact)];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setDiagrams((prev) => prev.filter((d) => d.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, supabase]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  /**
   * Debounced database update function
   * Reduces database writes for better performance (Requirement 26.2)
   */
  const debouncedUpdate = useCallback(
    async (diagramId: string, diagram: Diagram) => {
      // Clear existing timer
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      // Store pending update
      pendingUpdateRef.current = { diagramId, diagram };

      // Set new timer
      updateTimerRef.current = setTimeout(async () => {
        const pending = pendingUpdateRef.current;
        if (!pending) return;

        try {
          const { error } = await supabase
            .from('artifacts')
            .update({
              content: {
                diagram_metadata: {
                  id: pending.diagram.id,
                  type: pending.diagram.type,
                },
                nodes: convertNodesToStableKeyFormat(pending.diagram.nodes),
                edges: convertEdgesToStableKeyFormat(pending.diagram.edges),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', pending.diagramId);

          if (error) {
            console.error('Failed to update diagram:', error);
          }
        } catch (error) {
          console.error('Failed to update diagram:', error);
        } finally {
          pendingUpdateRef.current = null;
        }
      }, UPDATE_DEBOUNCE_DELAY);
    },
    [supabase]
  );

  // Handle node changes with debouncing (Requirement 26.2, 26.3)
  const handleNodesChange = useCallback(
    async (updatedNodes: DiagramNode[]) => {
      if (!selectedDiagram) return;

      const updatedDiagram: Diagram = {
        ...selectedDiagram,
        nodes: updatedNodes,
      };

      // Optimistic update for immediate UI feedback
      setDiagrams((prev) =>
        prev.map((d) => (d.id === selectedDiagram.id ? updatedDiagram : d))
      );

      // Debounced database update
      debouncedUpdate(selectedDiagram.id, updatedDiagram);
    },
    [selectedDiagram, debouncedUpdate]
  );

  // Handle edge changes with debouncing (Requirement 26.2, 26.3)
  const handleEdgesChange = useCallback(
    async (updatedEdges: DiagramEdge[]) => {
      if (!selectedDiagram) return;

      const updatedDiagram: Diagram = {
        ...selectedDiagram,
        edges: updatedEdges,
      };

      // Optimistic update for immediate UI feedback
      setDiagrams((prev) =>
        prev.map((d) => (d.id === selectedDiagram.id ? updatedDiagram : d))
      );

      // Debounced database update
      debouncedUpdate(selectedDiagram.id, updatedDiagram);
    },
    [selectedDiagram, debouncedUpdate]
  );

  if (diagrams.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          No diagrams yet. Create your first diagram to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Diagram list sidebar */}
      <div className="w-64 flex-shrink-0 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Diagrams
        </h3>
        {diagrams.map((diagram) => (
          <button
            key={diagram.id}
            onClick={() => setSelectedDiagramId(diagram.id)}
            className={`w-full rounded-lg p-3 text-left text-sm transition-colors ${
              selectedDiagramId === diagram.id
                ? 'bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                : 'hover:bg-zinc-50 text-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            <div className="font-medium">
              {diagram.metadata?.name || `Diagram ${diagram.id.slice(0, 8)}`}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              {diagram.type.toUpperCase()} • {diagram.nodes.length} nodes
            </div>
          </button>
        ))}
      </div>

      {/* Canvas area */}
      <div className="flex-1 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {selectedDiagram ? (
          <DiagramCanvas
            nodes={selectedDiagram.nodes}
            edges={selectedDiagram.edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              Select a diagram to view
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Parse artifact from database into Diagram format
 */
function parseDiagramArtifact(artifact: any): Diagram {
  const content = artifact.content || {};
  const metadata = content.diagram_metadata || {};
  const nodes = content.nodes || {};
  const edges = content.edges || {};

  return {
    id: artifact.id,
    type: metadata.type || 'class',
    nodes: Object.entries(nodes).map(([id, node]: [string, any]) => ({
      id,
      type: node.type || 'class',
      position: node.position || { x: 0, y: 0 },
      data: node.data || { label: id },
    })),
    edges: Object.entries(edges).map(([id, edge]: [string, any]) => ({
      id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'association',
      label: edge.label,
      multiplicity: edge.multiplicity,
    })),
    metadata: {
      name: metadata.name,
      description: metadata.description,
    },
  };
}

/**
 * Convert nodes to stable key format for database storage
 */
function convertNodesToStableKeyFormat(nodes: DiagramNode[]): Record<string, any> {
  return nodes.reduce((acc, node) => {
    acc[node.id] = {
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    };
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Convert edges to stable key format for database storage
 */
function convertEdgesToStableKeyFormat(edges: DiagramEdge[]): Record<string, any> {
  return edges.reduce((acc, edge) => {
    acc[edge.id] = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      label: edge.label,
      multiplicity: edge.multiplicity,
    };
    return acc;
  }, {} as Record<string, any>);
}
