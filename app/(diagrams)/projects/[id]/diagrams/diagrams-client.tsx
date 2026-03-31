"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LayoutTemplate,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DiagramCanvas } from "@/components/dashboard/diagram-canvas";
import { CreateDiagramDialog } from "@/components/dashboard/create-diagram-dialog";
import SyncSuggestionsPanel from "@/components/dashboard/sync-suggestions-panel";
import type { RequirementSuggestion } from "@/lib/agents/architect";
import { createClient } from "@/lib/supabase/client";
import type { Diagram, DiagramEdge, DiagramNode } from "@/lib/types/diagram";
import { computeLayout } from "@/lib/utils/diagram-layout";

interface DiagramsClientProps {
  projectId: string;
  projectName: string;
  userEmail: string;
  initialDiagrams: Diagram[];
}

function parseDiagramArtifact(artifact: any): Diagram {
  const content = artifact.content || {};
  const metadata = content.diagram_metadata || {};
  const nodes = content.nodes || {};
  const edges = content.edges || {};
  return {
    id: artifact.id,
    type: metadata.type || "class",
    nodes: Object.entries(nodes).map(([id, node]: [string, any]) => ({
      id,
      type: node.type || "class",
      position: node.position || { x: 0, y: 0 },
      data: node.data || { label: id },
    })),
    edges: Object.entries(edges).map(([id, edge]: [string, any]) => ({
      id,
      source: edge.source,
      target: edge.target,
      type: edge.type || "association",
      label: edge.label,
      multiplicity: edge.multiplicity,
    })),
    metadata: { name: metadata.name, description: metadata.description },
  };
}

export function DiagramsClient({
  projectId,
  projectName,
  userEmail,
  initialDiagrams,
}: DiagramsClientProps) {
  const [diagrams, setDiagrams] = useState<Diagram[]>(initialDiagrams);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDiagrams[0]?.id ?? null,
  );
  const [isLoading, setIsLoading] = useState(initialDiagrams.length === 0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<RequirementSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  useEffect(() => {
    if (initialDiagrams.length > 0) return;
    supabase
      .from("artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", "diagram")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const parsed = (data || []).map(parseDiagramArtifact);
        setDiagrams(parsed);
        if (parsed.length > 0) setSelectedId(parsed[0].id);
        setIsLoading(false);
      });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDiagram = diagrams.find((d) => d.id === selectedId) ?? null;

  const persistDiagram = useCallback(
    async (diagram: Diagram) => {
      await supabase
        .from("artifacts")
        .update({
          content: {
            diagram_metadata: { type: diagram.type, name: diagram.metadata?.name },
            nodes: Object.fromEntries(diagram.nodes.map((n) => [n.id, n])),
            edges: Object.fromEntries(diagram.edges.map((e) => [e.id, e])),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", diagram.id);
    },
    [supabase],
  );

  const handleNodesChange = useCallback(
    async (updatedNodes: DiagramNode[]) => {
      if (!selectedDiagram) return;
      const updated = { ...selectedDiagram, nodes: updatedNodes };
      setDiagrams((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      await persistDiagram(updated);
    },
    [selectedDiagram, persistDiagram],
  );

  const handleEdgesChange = useCallback(
    async (updatedEdges: DiagramEdge[]) => {
      if (!selectedDiagram) return;
      const updated = { ...selectedDiagram, edges: updatedEdges };
      setDiagrams((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      await persistDiagram(updated);
    },
    [selectedDiagram, persistDiagram],
  );

  const handleRelayout = useCallback(async () => {
    if (!selectedDiagram || selectedDiagram.nodes.length === 0) return;
    const positions = computeLayout(
      selectedDiagram.nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      selectedDiagram.edges,
    );
    const relaidNodes = selectedDiagram.nodes.map((n) => ({
      ...n,
      position: positions.get(n.id) ?? n.position,
    }));
    const updated = { ...selectedDiagram, nodes: relaidNodes };
    setDiagrams((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setLayoutVersion((v) => v + 1);
    await persistDiagram(updated);
  }, [selectedDiagram, persistDiagram]);

  const handleCreateDiagram = useCallback(
    async (name: string, type: string, syncWithRequirements: boolean) => {
      setIsCreating(true);
      try {
        if (syncWithRequirements) {
          const res = await fetch("/api/architect/generate-diagram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, diagramType: type, diagramName: name }),
          });
          if (!res.ok) throw new Error((await res.json()).error || "Failed");
          const data = await res.json();
          if (data.diagramArtifact) {
            const parsed = parseDiagramArtifact(data.diagramArtifact);
            setDiagrams((prev) => [...prev, parsed]);
            setSelectedId(parsed.id);
            setShowCreateDialog(false);
            return;
          }
        }
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");
        const { data, error } = await supabase
          .from("artifacts")
          .insert({
            project_id: projectId,
            type: "diagram",
            content: { diagram_metadata: { type, name }, nodes: {}, edges: {} },
            created_by: userData.user.id,
          })
          .select()
          .single();
        if (error) throw error;
        const parsed = parseDiagramArtifact(data);
        setDiagrams((prev) => [...prev, parsed]);
        setSelectedId(parsed.id);
        setShowCreateDialog(false);
      } catch (err) {
        alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setIsCreating(false);
      }
    },
    [projectId, supabase],
  );

  const handleDeleteDiagram = useCallback(
    async (diagramId: string) => {
      if (!confirm("Delete this diagram? This cannot be undone.")) return;
      const { error } = await supabase.from("artifacts").delete().eq("id", diagramId);
      if (error) { alert("Failed to delete diagram"); return; }
      setDiagrams((prev) => {
        const next = prev.filter((d) => d.id !== diagramId);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
    },
    [supabase],
  );

  const handleGenerateSuggestions = useCallback(async () => {
    if (!selectedDiagram) return;
    if (selectedDiagram.nodes.length === 0) {
      alert("Cannot sync an empty diagram. Add some nodes first.");
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/architect/suggest-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagramId: selectedDiagram.id, projectId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
      if (!data.suggestions?.length) alert("No suggestions generated.");
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [selectedDiagram, projectId]);

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full overflow-hidden">
        {/* ── Sidebar ── */}
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="border-b px-4 py-3">
            <Link
              href={`/dashboard/projects/${projectId}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4 shrink-0" />
              <span className="truncate">{projectName}</span>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center justify-between pr-2">
                Diagrams
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="rounded p-0.5 hover:bg-sidebar-accent"
                  title="New diagram"
                >
                  <Plus className="size-3.5" />
                </button>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoading ? (
                    <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
                  ) : diagrams.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-muted-foreground">No diagrams yet.</p>
                  ) : (
                    diagrams.map((diagram) => (
                      <SidebarMenuItem key={diagram.id}>
                        <SidebarMenuButton
                          isActive={selectedId === diagram.id}
                          onClick={() => setSelectedId(diagram.id)}
                          className="pr-8"
                        >
                          <LayoutTemplate className="size-4 shrink-0" />
                          <span className="truncate">
                            {diagram.metadata?.name || `Diagram ${diagram.id.slice(0, 6)}`}
                          </span>
                        </SidebarMenuButton>
                        <SidebarMenuAction
                          onClick={() => handleDeleteDiagram(diagram.id)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </SidebarMenuAction>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t p-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-xs text-muted-foreground flex-1">{userEmail}</span>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* ── Main canvas area ── */}
        <SidebarInset className="flex flex-col overflow-hidden">
          {/* Topbar */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium truncate">
              {selectedDiagram?.metadata?.name || "Select a diagram"}
            </span>
            {selectedDiagram && (
              <span className="text-xs text-muted-foreground ml-1">
                ({selectedDiagram.nodes.length} nodes, {selectedDiagram.edges.length} edges)
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {selectedDiagram && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRelayout}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <RefreshCw className="size-3" />
                    Re-layout
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateSuggestions}
                    disabled={loadingSuggestions}
                    className="h-7 text-xs"
                  >
                    {loadingSuggestions ? "Analyzing…" : "Sync to Requirements"}
                  </Button>
                </>
              )}
            </div>
          </header>

          {/* Canvas + suggestions panel */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {selectedDiagram ? (
                <DiagramCanvas
                  key={`${selectedDiagram.id}-${layoutVersion}`}
                  nodes={selectedDiagram.nodes}
                  edges={selectedDiagram.edges}
                  diagramType={selectedDiagram.type}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  {diagrams.length === 0
                    ? "Create your first diagram to get started."
                    : "Select a diagram from the sidebar."}
                </div>
              )}
            </div>

            {/* Suggestions panel */}
            {showSuggestions && selectedDiagram && (
              <div className="w-80 shrink-0 border-l flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-semibold">Sync Suggestions</span>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <SyncSuggestionsPanel
                    suggestions={suggestions}
                    suggestionType="requirement"
                    artifactId={selectedDiagram.id}
                    projectId={projectId}
                    onSuggestionApplied={() => { setSuggestions([]); setShowSuggestions(false); }}
                  />
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </div>

      <CreateDiagramDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateDiagram={handleCreateDiagram}
        isCreating={isCreating}
      />
    </SidebarProvider>
  );
}
