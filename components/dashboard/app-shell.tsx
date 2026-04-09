"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Code2,
  FileCode,
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
import RequirementsTable, { type Requirement } from "@/components/dashboard/requirements-table";
import { RequirementDetailsDialog, type RequirementDetails } from "@/components/dashboard/requirement-details-dialog";
import { TextToRequirementsDialog } from "@/components/dashboard/text-to-requirements-dialog";
import { NodeLinksPanel } from "@/components/dashboard/node-links-panel";
import { ProjectsDialog } from "@/components/dashboard/projects-dialog";
import { GenerateCodeDialog } from "@/components/dashboard/generate-code-dialog";
import type { DiagramSuggestion } from "@/lib/agents/architect";
import type { JSONPatch } from "@/lib/agents/json-patch";
import { createClient } from "@/lib/supabase/client";
import type { Diagram, DiagramEdge, DiagramNode } from "@/lib/types/diagram";
import { computeLayout } from "@/lib/utils/diagram-layout";
import { createRequirement, updateRequirement, deleteRequirement } from "@/lib/api/requirements";
import { getLinksForProject, createLink, deleteLink, type TraceabilityLinkRow } from "@/lib/api/links";
import { getDepsForProject, createDependency, deleteDependency, type RequirementDependency } from "@/lib/api/dependencies";
import type { LinkType } from "@/lib/agents/types";
import { useDebounce } from "@/lib/hooks/use-debounce";

type View = "diagrams" | "requirements" | "code";

interface Project {
  id: string;
  name: string;
  description: string | null;
  version: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

interface AppShellProps {
  initialProjects: Project[];
  userEmail: string;
  userId: string;
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

export function AppShell({ initialProjects, userEmail, userId }: AppShellProps) {
  const router = useRouter();
  const supabase = createClient();

  // ── Project state ──
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProject, setSelectedProject] = useState<Project | null>(initialProjects[0] ?? null);
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);

  // ── View toggle ──
  const [view, setView] = useState<View>("diagrams");

  // ── Diagram state ──
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [diagramsLoading, setDiagramsLoading] = useState(false);
  const [showCreateDiagram, setShowCreateDiagram] = useState(false);
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [showDiagramSuggestions, setShowDiagramSuggestions] = useState(false);
  const [diagramSuggestions, setDiagramSuggestions] = useState<DiagramSuggestion[]>([]);
  const [loadingDiagramSuggestions, setLoadingDiagramSuggestions] = useState(false);

  // ── Requirements state ──
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, { field: string; value: string }>>(new Map());
  const debouncedUpdates = useDebounce(pendingUpdates, 500);
  const [editingRequirement, setEditingRequirement] = useState<RequirementDetails | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showTextToReqDialog, setShowTextToReqDialog] = useState(false);
  const [isGeneratingReqs, setIsGeneratingReqs] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showReqSuggestions, setShowReqSuggestions] = useState(false);
  const [reqSuggestions, setReqSuggestions] = useState<DiagramSuggestion[]>([]);
  const [loadingReqSuggestions, setLoadingReqSuggestions] = useState(false);
  const [selectedDiagramForReq, setSelectedDiagramForReq] = useState<string | null>(null);

  // ── Code state ──
  const [codeArtifacts, setCodeArtifacts] = useState<any[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [showGenerateCodeDialog, setShowGenerateCodeDialog] = useState(false);

  // ── Traceability links state ──
  const [links, setLinks] = useState<TraceabilityLinkRow[]>([]);
  const [deps, setDeps] = useState<RequirementDependency[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [isAuditingLinks, setIsAuditingLinks] = useState(false);

  const selectedDiagram = diagrams.find((d) => d.id === selectedDiagramId) ?? null;

  // Keep a ref so async callbacks always read the latest diagram without stale closure
  const selectedDiagramRef = useRef(selectedDiagram);
  useEffect(() => { selectedDiagramRef.current = selectedDiagram; }, [selectedDiagram]);

  // ── Load data when project changes ──
  useEffect(() => {
    if (!selectedProject) return;
    setDiagramsLoading(true);
    setDiagrams([]);
    setSelectedDiagramId(null);
    setRequirements([]);
    setLinks([]);
    setDeps([]);
    setSelectedNodeId(null);

    const projectId = selectedProject.id;

    // Load diagrams
    supabase
      .from("artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", "diagram")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const parsed = (data || []).map(parseDiagramArtifact);
        setDiagrams(parsed);
        setSelectedDiagramId(parsed[0]?.id ?? null);
        setDiagramsLoading(false);
      });

    // Load requirements
    supabase
      .from("artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", "requirement")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setRequirements(
          (data || []).map((a) => ({
            id: a.id,
            req_id: a.content.req_id,
            title: a.content.title,
            type: a.content.type,
            priority: a.content.priority,
            status: a.content.status,
            description: a.content.description || "",
            links: a.content.links || [],
            tags: a.content.metadata?.tags || [],
          }))
        );
      });

    // Load traceability links
    getLinksForProject(projectId).then(setLinks).catch(console.error);

    // Load code artifacts
    setCodeArtifacts([]);
    setSelectedCodeId(null);
    supabase
      .from("artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", "code")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCodeArtifacts(data ?? []); setSelectedCodeId(data?.[0]?.id ?? null); });
    // Load requirement dependencies
    getDepsForProject(projectId).then(setDeps).catch(console.error);

    // Realtime subscription
    const channel = supabase
      .channel(`project:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "artifacts", filter: `project_id=eq.${projectId}` }, (payload) => {
        const type = (payload.new as any)?.type;
        if (payload.eventType === "INSERT" && type === "requirement") {
          const n = payload.new as any;
          setRequirements((prev) => {
            if (prev.some((r) => r.id === n.id)) return prev;
            return [...prev, { id: n.id, req_id: n.content.req_id, title: n.content.title, type: n.content.type, priority: n.content.priority, status: n.content.status, description: n.content.description || "", links: n.content.links || [], tags: n.content.metadata?.tags || [] }];
          });
        } else if (payload.eventType === "UPDATE" && (payload.new as any).type === "requirement") {
          const n = payload.new as any;
          setRequirements((prev) => prev.map((r) => r.id === n.id ? { id: n.id, req_id: n.content.req_id, title: n.content.title, type: n.content.type, priority: n.content.priority, status: n.content.status, description: n.content.description || "", links: n.content.links || [], tags: n.content.metadata?.tags || [] } : r));
        } else if (payload.eventType === "DELETE") {
          setRequirements((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced requirement updates ──
  useEffect(() => {
    if (debouncedUpdates.size === 0) return;
    const run = async () => {
      for (const [id, update] of debouncedUpdates.entries()) {
        try { await updateRequirement(id, update.field as any, update.value); } catch {}
      }
      setPendingUpdates(new Map());
    };
    run();
  }, [debouncedUpdates]);

  // ── Sign out ──
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  // ── Diagram handlers ──
  const persistDiagram = useCallback(async (diagram: Diagram) => {
    await supabase.from("artifacts").update({
      content: { diagram_metadata: { type: diagram.type, name: diagram.metadata?.name }, nodes: Object.fromEntries(diagram.nodes.map((n) => [n.id, n])), edges: Object.fromEntries(diagram.edges.map((e) => [e.id, e])) },
      updated_at: new Date().toISOString(),
    }).eq("id", diagram.id);
  }, [supabase]);

  const handleNodesChange = useCallback(async (updatedNodes: DiagramNode[]) => {
    const diagram = selectedDiagramRef.current;
    if (!diagram) return;
    const updated = { ...diagram, nodes: updatedNodes };
    setDiagrams((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    await persistDiagram(updated);
  }, [persistDiagram]);

  const handleEdgesChange = useCallback(async (updatedEdges: DiagramEdge[]) => {
    const diagram = selectedDiagramRef.current;
    if (!diagram) return;
    const updated = { ...diagram, edges: updatedEdges };
    setDiagrams((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    await persistDiagram(updated);
  }, [persistDiagram]);

  const handleRelayout = useCallback(async () => {
    const diagram = selectedDiagramRef.current;
    if (!diagram || diagram.nodes.length === 0) return;
    const positions = computeLayout(diagram.nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })), diagram.edges);
    const relaidNodes = diagram.nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }));
    const updated = { ...diagram, nodes: relaidNodes };
    setDiagrams((prev) => prev.map((d) => d.id === updated.id ? updated : d));
    setLayoutVersion((v) => v + 1);
    await persistDiagram(updated);
  }, [persistDiagram]);

  const handleCreateDiagram = useCallback(async (name: string, type: string, syncWithRequirements: boolean) => {
    if (!selectedProject) return;
    setIsCreatingDiagram(true);
    try {
      if (syncWithRequirements) {
        const res = await fetch("/api/architect/generate-diagram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: selectedProject.id, diagramType: type, diagramName: name }) });
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        const data = await res.json();
        if (data.diagramArtifact) {
          const parsed = parseDiagramArtifact(data.diagramArtifact);
          setDiagrams((prev) => [...prev, parsed]);
          setSelectedDiagramId(parsed.id);
          setShowCreateDiagram(false);
          // Refresh links now that the new diagram's traceability links are saved
          getLinksForProject(selectedProject.id).then(setLinks).catch(console.error);
          return;
        }
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from("artifacts").insert({ project_id: selectedProject.id, type: "diagram", content: { diagram_metadata: { type, name }, nodes: {}, edges: {} }, created_by: userData.user.id }).select().single();
      if (error) throw error;
      const parsed = parseDiagramArtifact(data);
      setDiagrams((prev) => [...prev, parsed]);
      setSelectedDiagramId(parsed.id);
      setShowCreateDiagram(false);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsCreatingDiagram(false);
    }
  }, [selectedProject, supabase]);

  const handleDeleteDiagram = useCallback(async (diagramId: string) => {
    if (!confirm("Delete this diagram? This cannot be undone.")) return;
    const { error } = await supabase.from("artifacts").delete().eq("id", diagramId);
    if (error) { alert("Failed to delete diagram"); return; }
    setDiagrams((prev) => {
      const next = prev.filter((d) => d.id !== diagramId);
      setSelectedDiagramId(next[0]?.id ?? null);
      return next;
    });
  }, [supabase]);

  const handleSyncDiagramToRequirements = useCallback(async () => {
    if (!selectedDiagram) return;
    setLoadingDiagramSuggestions(true);
    try {
      const res = await fetch("/api/architect/suggest-diagram-updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirementDelta: [], diagramId: selectedDiagram.id, projectId: selectedProject?.id }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setDiagramSuggestions(data.suggestions || []);
      setShowDiagramSuggestions(true);
      if (!data.suggestions?.length) alert("Diagram is already in sync with requirements.");
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoadingDiagramSuggestions(false);
    }
  }, [selectedDiagram, selectedProject]);

  // ── Requirements handlers ──
  const handleReqUpdate = useCallback((id: string, field: string, value: string) => {
    setRequirements((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setPendingUpdates((prev) => { const m = new Map(prev); m.set(id, { field, value }); return m; });
  }, []);

  const handleReqCreate = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const result = await createRequirement(selectedProject.id, userId, { title: "New Requirement", description: "", type: "functional", priority: "medium", status: "draft" });
      setRequirements((prev) => [...prev, { id: result.id, req_id: result.content.req_id, title: result.content.title, type: result.content.type, priority: result.content.priority, status: result.content.status, description: result.content.description || "", links: result.content.links || [], tags: result.content.metadata?.tags || [] }]);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : JSON.stringify(err)}`);
    }
  }, [selectedProject, userId]);

  const handleReqDelete = useCallback(async (id: string) => {
    try {
      await deleteRequirement(id);
      setRequirements((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  const handleSaveReqDetails = useCallback(async (updated: RequirementDetails) => {
    try {
      const { data: current, error: fetchErr } = await supabase.from("artifacts").select("content, version").eq("id", updated.id).single();
      if (fetchErr) throw fetchErr;
      const { error: updateErr } = await supabase.from("artifacts").update({ content: { ...current.content, title: updated.title, description: updated.description, type: updated.type, priority: updated.priority, status: updated.status, links: updated.links || [], metadata: { ...current.content.metadata, tags: updated.tags || [] } }, updated_at: new Date().toISOString() }).eq("id", updated.id).eq("version", current.version);
      if (updateErr) throw updateErr;
      setRequirements((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [supabase]);

  // ── Node selection (Phase 3) ──
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => prev === nodeId ? null : nodeId);
  }, []);

  // ── Link management ──
  const handleAddLink = useCallback(async (requirementId: string, nodeId: string) => {
    if (!selectedDiagramId || !selectedProject) return;
    // Skip if already linked
    const alreadyExists = links.some(
      (l) => l.source_id === requirementId && l.target_node_id === nodeId
    );
    if (alreadyExists) return;
    try {
      const newLink = await createLink(requirementId, selectedDiagramId, nodeId);
      setLinks((prev) => [...prev, newLink]);
    } catch (err) {
      alert(`Failed to create link: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [selectedDiagramId, selectedProject, links]);

  const handleDeleteLink = useCallback(async (linkId: string) => {
    try {
      await deleteLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err) {
      alert(`Failed to delete link: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  // Navigate from requirements table chip → diagram view + highlight node
  const handleNavigateToNode = useCallback((diagramId: string, nodeId: string) => {
    setSelectedDiagramId(diagramId);
    setHighlightNodeId(nodeId);
    setView("diagrams");
    // Clear highlight after a moment so it can re-trigger if clicked again
    setTimeout(() => setHighlightNodeId(null), 2000);
  }, []);

  // Navigate from node panel → requirements view + scroll to requirement
  const handleNavigateToRequirement = useCallback((_requirementId: string) => {
    setSelectedNodeId(null);
    setView("requirements");
  }, []);

  // ── Audit Links (Phase 4) ──
  const handleAuditLinks = useCallback(async () => {
    if (!selectedDiagram || !selectedProject) return;
    setIsAuditingLinks(true);
    try {
      const reqIds = requirements.map((r) => r.id);
      const res = await fetch("/api/architect/create-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementIds: reqIds, diagramId: selectedDiagram.id, projectId: selectedProject.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      // Reload links
      const refreshed = await getLinksForProject(selectedProject.id);
      setLinks(refreshed);
      alert(`Audit complete. ${data.count} new links created.`);
    } catch (err) {
      alert(`Audit failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsAuditingLinks(false);
    }
  }, [selectedDiagram, selectedProject, requirements]);

  const handleSyncReqToDiagram = useCallback(async () => {    if (!selectedDiagramForReq) { alert("Select a diagram first"); return; }
    setLoadingReqSuggestions(true);
    try {
      const res = await fetch("/api/architect/suggest-diagram-updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirementDelta: { op: "replace", path: "/requirements/0/title", value: "Updated" }, diagramId: selectedDiagramForReq, projectId: selectedProject?.id }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setReqSuggestions(data.suggestions || []);
      setShowReqSuggestions(true);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoadingReqSuggestions(false);
    }
  }, [selectedDiagramForReq, selectedProject]);

  // ── Render ──
  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full overflow-hidden">
        {/* ── Left Sidebar ── */}
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="border-b px-3 py-3">
            <button
              onClick={() => setShowProjectsDialog(true)}
              className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-sm font-medium hover:bg-sidebar-accent transition-colors text-left"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
                {selectedProject?.name.charAt(0).toUpperCase() ?? "?"}
              </span>
              <span className="flex-1 truncate">{selectedProject?.name ?? "Select Project"}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </SidebarHeader>

          <SidebarContent>
            {view === "diagrams" && (
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center justify-between pr-2">
                  Diagrams
                  <button onClick={() => setShowCreateDiagram(true)} className="rounded p-0.5 hover:bg-sidebar-accent" title="New diagram">
                    <Plus className="size-3.5" />
                  </button>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {diagramsLoading ? (
                      <p className="px-2 py-4 text-xs text-muted-foreground">Loading…</p>
                    ) : diagrams.length === 0 ? (
                      <p className="px-2 py-4 text-xs text-muted-foreground">No diagrams yet.</p>
                    ) : (
                      diagrams.map((diagram) => (
                        <SidebarMenuItem key={diagram.id}>
                          <SidebarMenuButton isActive={selectedDiagramId === diagram.id} onClick={() => setSelectedDiagramId(diagram.id)} className="pr-8">
                            <LayoutTemplate className="size-4 shrink-0" />
                            <span className="truncate">{diagram.metadata?.name || `Diagram ${diagram.id.slice(0, 6)}`}</span>
                          </SidebarMenuButton>
                          <SidebarMenuAction onClick={() => handleDeleteDiagram(diagram.id)} title="Delete" className="text-destructive hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </SidebarMenuAction>
                        </SidebarMenuItem>
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
            {view === "code" && (
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center justify-between pr-2">
                  Generated Code
                  <button onClick={() => setShowGenerateCodeDialog(true)} className="rounded p-0.5 hover:bg-sidebar-accent" title="Generate code">
                    <Plus className="size-3.5" />
                  </button>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {codeArtifacts.length === 0 ? (
                      <p className="px-2 py-4 text-xs text-muted-foreground">No code generated yet.</p>
                    ) : (
                      codeArtifacts.map((artifact) => {
                        const lang = artifact.metadata?.language ?? "";
                        const filePath = artifact.metadata?.filePath ?? artifact.id.slice(0, 8);
                        return (
                          <SidebarMenuItem key={artifact.id}>
                            <SidebarMenuButton isActive={selectedCodeId === artifact.id} onClick={() => setSelectedCodeId(artifact.id)} className="pr-8">
                              <FileCode className="size-4 shrink-0" />
                              <span className="truncate flex-1">{filePath}</span>
                              <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${langBadgeClass(lang)}`}>
                                {langShort(lang)}
                              </span>
                            </SidebarMenuButton>
                            <SidebarMenuAction
                              onClick={async () => {
                                if (!confirm("Delete this file?")) return;
                                await supabase.from("artifacts").delete().eq("id", artifact.id);
                                setCodeArtifacts((prev) => {
                                  const next = prev.filter((a) => a.id !== artifact.id);
                                  if (selectedCodeId === artifact.id) setSelectedCodeId(next[0]?.id ?? null);
                                  return next;
                                });
                              }}
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </SidebarMenuAction>
                          </SidebarMenuItem>
                        );
                      })
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t p-3">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-xs text-muted-foreground flex-1">{userEmail}</span>
              <button onClick={handleSignOut} title="Sign out" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                <LogOut className="size-3.5" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* ── Main area ── */}
        <SidebarInset className="flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />

            {/* Project name */}
            <span className="text-sm font-medium truncate max-w-[160px]">
              {selectedProject?.name ?? "No project"}
            </span>

            {/* View toggle */}
            <div className="ml-4 flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
              {(["diagrams", "requirements", "code"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded px-3 py-1 capitalize transition-colors ${view === v ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* View-specific actions */}
            <div className="ml-auto flex items-center gap-2">
              {view === "diagrams" && selectedDiagram && (
                <>
                  <Button size="sm" variant="outline" onClick={handleRelayout} className="h-7 gap-1.5 text-xs">
                    <RefreshCw className="size-3" />
                    Re-layout
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleSyncDiagramToRequirements} disabled={loadingDiagramSuggestions} className="h-7 text-xs">
                    {loadingDiagramSuggestions ? "Analyzing…" : "Sync to Requirements"}
                  </Button>
                  {requirements.length > 0 && (
                    <Button size="sm" variant="outline" onClick={handleAuditLinks} disabled={isAuditingLinks} className="h-7 text-xs">
                      {isAuditingLinks ? "Auditing…" : "Audit Links"}
                    </Button>
                  )}
                  {diagramSuggestions.length > 0 && (
                    <Button size="sm" variant={showDiagramSuggestions ? "default" : "outline"} onClick={() => setShowDiagramSuggestions((v) => !v)} className="h-7 text-xs">
                      {showDiagramSuggestions ? "Hide" : `Suggestions (${diagramSuggestions.length})`}
                    </Button>
                  )}
                </>
              )}              {view === "code" && (
                <Button size="sm" onClick={() => setShowGenerateCodeDialog(true)} className="h-7 gap-1.5 text-xs">
                  <Plus className="size-3" />
                  Generate Code
                </Button>
              )}
              {view === "requirements" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setShowTextToReqDialog(true)} className="h-7 text-xs">
                    Convert Text
                  </Button>
                  {diagrams.length > 0 && (
                    <>
                      <select
                        value={selectedDiagramForReq || ""}
                        onChange={(e) => setSelectedDiagramForReq(e.target.value)}
                        className="h-7 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Select diagram…</option>
                        {diagrams.map((d) => (
                          <option key={d.id} value={d.id}>{d.metadata?.name || `Diagram ${d.id.slice(0, 6)}`}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" onClick={handleSyncReqToDiagram} disabled={loadingReqSuggestions || !selectedDiagramForReq} className="h-7 text-xs">
                        {loadingReqSuggestions ? "Analyzing…" : "Sync to Diagram"}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </header>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main view */}
            <div className="flex-1 overflow-hidden">
              {!selectedProject ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center">
                    <p>No project selected.</p>
                    <button onClick={() => setShowProjectsDialog(true)} className="mt-2 text-primary underline text-sm">Open Projects</button>
                  </div>
                </div>
              ) : view === "diagrams" ? (
                selectedDiagram ? (
                  <DiagramCanvas
                    key={`${selectedDiagram.id}-${layoutVersion}`}
                    nodes={selectedDiagram.nodes}
                    edges={selectedDiagram.edges}
                    diagramType={selectedDiagram.type}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onNodeClick={handleNodeSelect}
                    highlightNodeId={highlightNodeId}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                    {diagramsLoading ? "Loading diagrams…" : diagrams.length === 0 ? (
                      <div className="text-center">
                        <p>No diagrams yet.</p>
                        <button onClick={() => setShowCreateDiagram(true)} className="mt-2 text-primary underline text-sm">Create one</button>
                      </div>
                    ) : "Select a diagram from the sidebar."}
                  </div>
                )
              ) : view === "requirements" ? (
                <div className="h-full overflow-y-auto p-6">
                  {isGeneratingReqs && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
                      <div className="flex items-center gap-3">
                        <svg className="h-5 w-5 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          AI is generating requirements… {generationProgress > 0 && `(${generationProgress} created)`}
                        </p>
                      </div>
                    </div>
                  )}
                  <RequirementsTable
                    requirements={requirements}
                    links={links}
                    diagrams={diagrams}
                    dependencies={deps}
                    onUpdate={handleReqUpdate}
                    onCreate={handleReqCreate}
                    onEditDetails={(r) => { setEditingRequirement(r as RequirementDetails); setShowDetailsDialog(true); }}
                    onDelete={handleReqDelete}
                    onNavigateToNode={handleNavigateToNode}
                  />
                </div>
              ) : (
                <CodeView
                  artifact={codeArtifacts.find((a) => a.id === selectedCodeId) ?? null}
                  projectId={selectedProject.id}
                  onGenerateClick={() => setShowGenerateCodeDialog(true)}
                />
              )}
            </div>

            {/* Node links panel (Phase 3) */}
            {view === "diagrams" && selectedNodeId && selectedDiagram && (
              <div className="w-72 shrink-0 border-l flex flex-col overflow-hidden">
                <NodeLinksPanel
                  nodeId={selectedNodeId}
                  nodeLabel={selectedDiagram.nodes.find((n) => n.id === selectedNodeId)?.data.label ?? selectedNodeId}
                  links={links}
                  requirements={requirements}
                  onAddLink={(reqId) => handleAddLink(reqId, selectedNodeId)}
                  onDeleteLink={handleDeleteLink}
                  onNavigateToRequirement={handleNavigateToRequirement}
                  onClose={() => setSelectedNodeId(null)}
                />
              </div>
            )}

            {/* Diagram suggestions panel */}
            {view === "diagrams" && showDiagramSuggestions && selectedDiagram && (
              <DiagramSuggestionsPanel                suggestions={diagramSuggestions}
                artifactId={selectedDiagram.id}
                projectId={selectedProject!.id}
                onClose={() => setShowDiagramSuggestions(false)}
                onApplied={async () => {
                  const { data } = await supabase.from("artifacts").select("*").eq("id", selectedDiagram.id).single();
                  if (data) { const r = parseDiagramArtifact(data); setDiagrams((prev) => prev.map((d) => d.id === r.id ? r : d)); setLayoutVersion((v) => v + 1); }
                }}
              />
            )}

            {/* Requirements suggestions panel */}
            {view === "requirements" && showReqSuggestions && selectedDiagramForReq && (
              <div className="w-96 shrink-0 border-l flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-semibold">Sync Suggestions</span>
                  <button onClick={() => setShowReqSuggestions(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <SyncSuggestionsPanel suggestions={reqSuggestions} suggestionType="diagram" artifactId={selectedDiagramForReq} projectId={selectedProject!.id} onSuggestionApplied={() => { setReqSuggestions([]); setShowReqSuggestions(false); }} />
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </div>

      {/* Dialogs */}
      <ProjectsDialog
        open={showProjectsDialog}
        onOpenChange={setShowProjectsDialog}
        projects={projects}
        selectedProjectId={selectedProject?.id ?? null}
        onSelectProject={(p) => { setSelectedProject(p); setView("diagrams"); }}
        onProjectsChange={setProjects}
      />
      <CreateDiagramDialog
        open={showCreateDiagram}
        onOpenChange={setShowCreateDiagram}
        onCreateDiagram={handleCreateDiagram}
        isCreating={isCreatingDiagram}
      />
      <RequirementDetailsDialog
        requirement={editingRequirement}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        onSave={handleSaveReqDetails}
        allRequirements={requirements as RequirementDetails[]}
        dependencies={deps}
        onDependencyCreated={(dep) => setDeps((prev) => [...prev, dep])}
        onDependencyDeleted={(depId) => setDeps((prev) => prev.filter((d) => d.id !== depId))}
      />
      <TextToRequirementsDialog
        projectId={selectedProject?.id ?? ""}
        open={showTextToReqDialog}
        onOpenChange={setShowTextToReqDialog}
        onSuccess={() => {}}
        onRequirementCreated={(artifact) => {
          const newReq = { id: artifact.id, req_id: artifact.content.req_id, title: artifact.content.title, type: artifact.content.type, priority: artifact.content.priority, status: artifact.content.status, description: artifact.content.description || "", links: artifact.content.links || [], tags: artifact.content.metadata?.tags || [] };
          setRequirements((prev) => prev.some((r) => r.id === newReq.id) ? prev : [...prev, newReq]);
          setGenerationProgress((p) => p + 1);
        }}
        onDependencyCreated={(dep) => setDeps((prev) => [...prev, dep])}
        onGenerationStart={() => { setIsGeneratingReqs(true); setGenerationProgress(0); }}
        onGenerationComplete={() => { setIsGeneratingReqs(false); setGenerationProgress(0); }}
      />
      <GenerateCodeDialog
        open={showGenerateCodeDialog}
        onOpenChange={setShowGenerateCodeDialog}
        diagrams={diagrams.map((d) => ({ id: d.id, content: { diagram_metadata: { name: d.metadata?.name, type: d.type } } }))}
        onSuccess={(newArtifacts) => {
          setCodeArtifacts((prev) => [...newArtifacts, ...prev]);
          if (newArtifacts.length > 0) setSelectedCodeId(newArtifacts[0].id);
        }}
      />
    </SidebarProvider>  );
}

// ── Code view helpers ──
function langBadgeClass(lang: string) {
  switch (lang?.toLowerCase()) {
    case "typescript": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "python": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "java": return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    default: return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

function langShort(lang: string) {
  switch (lang?.toLowerCase()) {
    case "typescript": return "ts";
    case "python": return "py";
    case "java": return "java";
    default: return lang?.slice(0, 4) ?? "?";
  }
}

// Map our language names to highlight.js language identifiers
function hlLang(lang: string): string {
  switch (lang?.toLowerCase()) {
    case "typescript": return "typescript";
    case "python": return "python";
    case "java": return "java";
    default: return "plaintext";
  }
}

function CodeView({ artifact, projectId, onGenerateClick }: { artifact: any | null; projectId: string; onGenerateClick: () => void }) {
  const [SyntaxHighlighter, setSyntaxHighlighter] = useState<any>(null);
  const [hlStyle, setHlStyle] = useState<any>(null);

  // Dynamically import to avoid SSR issues
  useEffect(() => {
    Promise.all([
      import("react-syntax-highlighter"),
      import("react-syntax-highlighter/dist/esm/styles/hljs/github"),
    ]).then(([mod, styleMod]) => {
      setSyntaxHighlighter(() => mod.Light);
      setHlStyle(styleMod.default);
    });
  }, []);

  if (!artifact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
        <Code2 className="size-8 opacity-30" />
        <p>Select a file or generate code from a diagram</p>
        <button onClick={onGenerateClick} className="text-primary underline text-xs">Generate Code</button>
      </div>
    );
  }

  const filePath = artifact.metadata?.filePath ?? "";
  const lang = artifact.metadata?.language ?? "";
  const sourceDiagramId = artifact.metadata?.sourceDiagramId ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const files = (artifact.content?.files ?? {}) as Record<string, any>;
  const fileContent: string = (filePath && (files[filePath] as any)?.content) ?? (Object.values(files)[0] as any)?.content ?? "";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto bg-[#f6f8fa]">
        {SyntaxHighlighter && hlStyle ? (
          <SyntaxHighlighter
            language={hlLang(lang)}
            style={hlStyle}
            showLineNumbers
            lineNumberStyle={{ color: "#94a3b8", minWidth: "2.5em", paddingRight: "1em", userSelect: "none" }}
            customStyle={{ margin: 0, padding: "1.5rem", background: "#f6f8fa", fontSize: "0.8125rem", lineHeight: "1.6", minHeight: "100%" }}
          >
            {fileContent}
          </SyntaxHighlighter>
        ) : (
          <pre className="min-h-full p-6 text-sm leading-relaxed text-zinc-800 font-mono whitespace-pre">
            <code>{fileContent}</code>
          </pre>
        )}
      </div>
      {sourceDiagramId && (
        <div className="shrink-0 border-t bg-background px-4 py-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Traceability</p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground">
            <Code2 className="size-3 shrink-0" />
            Source diagram: {sourceDiagramId.slice(0, 8)}…
          </span>
        </div>
      )}
    </div>
  );
}

// ── Resizable diagram suggestions panel ──
function DiagramSuggestionsPanel({
  suggestions,
  artifactId,
  projectId,
  onClose,
  onApplied,
}: {
  suggestions: DiagramSuggestion[];
  artifactId: string;
  projectId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [width, setWidth] = useState(320);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (!dragging.current) return; setWidth(Math.max(260, Math.min(640, startW.current + (startX.current - e.clientX)))); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  return (
    <div className="shrink-0 border-l flex flex-col overflow-hidden relative" style={{ width }}>
      <div onMouseDown={onMouseDown} className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 z-10" />
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Sync Suggestions</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SyncSuggestionsPanel suggestions={suggestions} suggestionType="diagram" artifactId={artifactId} projectId={projectId} onSuggestionApplied={onApplied} />
      </div>
    </div>
  );
}
