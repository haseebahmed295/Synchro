"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Code2, FileCode, LogOut, Plus, Trash2 } from "lucide-react";
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
import { GenerateCodeDialog } from "@/components/dashboard/generate-code-dialog";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CodeArtifact {
  id: string;
  content: {
    code_metadata: { id: string; language: string; framework?: string | null; version: string };
    files: Record<string, { path: string; content: string; ast_hash: string; links: string[] }>;
    dependencies: string[];
  };
  metadata: {
    filePath: string;
    language: string;
    sourceDiagramId: string;
    sourceDiagramNodeId: string | null;
    generationTime: number;
  };
}

interface DiagramOption {
  id: string;
  content: {
    diagram_metadata?: { name?: string; type?: string };
  };
}

interface CodeClientProps {
  projectId: string;
  projectName: string;
  userEmail: string;
  initialCodeArtifacts: CodeArtifact[];
  diagrams: DiagramOption[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function langBadgeClass(lang: string) {
  switch (lang?.toLowerCase()) {
    case "typescript":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "python":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "java":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

function langShort(lang: string) {
  switch (lang?.toLowerCase()) {
    case "typescript":
      return "ts";
    case "python":
      return "py";
    case "java":
      return "java";
    default:
      return lang?.slice(0, 4) ?? "?";
  }
}

function getFileContent(artifact: CodeArtifact): string {
  const filePath = artifact.metadata?.filePath;
  if (filePath && artifact.content?.files?.[filePath]) {
    return artifact.content.files[filePath].content;
  }
  // fallback: first file
  const files = Object.values(artifact.content?.files ?? {});
  return files[0]?.content ?? "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CodeClient({
  projectId,
  projectName,
  userEmail,
  initialCodeArtifacts,
  diagrams,
}: CodeClientProps) {
  const [artifacts, setArtifacts] = useState<CodeArtifact[]>(initialCodeArtifacts);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCodeArtifacts[0]?.id ?? null,
  );
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const selectedArtifact = artifacts.find((a) => a.id === selectedId) ?? null;

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  const handleDelete = useCallback(
    async (artifactId: string) => {
      if (!confirm("Delete this file? This cannot be undone.")) return;
      const { error } = await supabase.from("artifacts").delete().eq("id", artifactId);
      if (error) { alert("Failed to delete file"); return; }
      setArtifacts((prev) => {
        const next = prev.filter((a) => a.id !== artifactId);
        if (selectedId === artifactId) setSelectedId(next[0]?.id ?? null);
        return next;
      });
    },
    [supabase, selectedId],
  );

  const handleGenerateSuccess = useCallback((newArtifacts: CodeArtifact[]) => {
    setArtifacts((prev) => [...newArtifacts, ...prev]);
    if (newArtifacts.length > 0) setSelectedId(newArtifacts[0].id);
  }, []);

  const fileContent = selectedArtifact ? getFileContent(selectedArtifact) : null;
  const lang = selectedArtifact?.metadata?.language ?? "";
  const filePath = selectedArtifact?.metadata?.filePath ?? "";
  const sourceDiagramId = selectedArtifact?.metadata?.sourceDiagramId ?? null;

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
                Generated Code
                <button
                  onClick={() => setShowGenerateDialog(true)}
                  className="rounded p-0.5 hover:bg-sidebar-accent"
                  title="Generate code"
                >
                  <Plus className="size-3.5" />
                </button>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {artifacts.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-muted-foreground">
                      No code generated yet.
                    </p>
                  ) : (
                    artifacts.map((artifact) => {
                      const aLang = artifact.metadata?.language ?? "";
                      const aPath = artifact.metadata?.filePath ?? artifact.id.slice(0, 8);
                      return (
                        <SidebarMenuItem key={artifact.id}>
                          <SidebarMenuButton
                            isActive={selectedId === artifact.id}
                            onClick={() => setSelectedId(artifact.id)}
                            className="pr-8"
                          >
                            <FileCode className="size-4 shrink-0" />
                            <span className="truncate flex-1">{aPath}</span>
                            <span
                              className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${langBadgeClass(aLang)}`}
                            >
                              {langShort(aLang)}
                            </span>
                          </SidebarMenuButton>
                          <SidebarMenuAction
                            onClick={() => handleDelete(artifact.id)}
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

        {/* ── Main area ── */}
        <SidebarInset className="flex flex-col overflow-hidden">
          {/* Topbar */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            {selectedArtifact ? (
              <>
                <Code2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{filePath}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${langBadgeClass(lang)}`}
                >
                  {langShort(lang)}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No file selected</span>
            )}
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={() => setShowGenerateDialog(true)}
                className="h-7 gap-1.5 text-xs"
              >
                <Plus className="size-3" />
                Generate Code
              </Button>
            </div>
          </header>

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {selectedArtifact && fileContent !== null ? (
              <>
                {/* Code viewer with syntax highlighting */}
                <CodeViewer language={lang} code={fileContent} />

                {/* Traceability section */}
                {sourceDiagramId && (
                  <div className="shrink-0 border-t bg-background px-4 py-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Traceability
                    </p>
                    <Link
                      href={`/dashboard/projects/${projectId}/diagrams`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors"
                      title={sourceDiagramId}
                    >
                      <Code2 className="size-3 shrink-0" />
                      Source diagram: {sourceDiagramId.slice(0, 8)}…
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                Select a file or generate code from a diagram
              </div>
            )}
          </div>
        </SidebarInset>
      </div>

      <GenerateCodeDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        diagrams={diagrams}
        onSuccess={handleGenerateSuccess}
      />
    </SidebarProvider>
  );
}

function hlLang(lang: string): string {
  switch (lang?.toLowerCase()) {
    case "typescript": return "typescript";
    case "python": return "python";
    case "java": return "java";
    default: return "plaintext";
  }
}

function CodeViewer({ language, code }: { language: string; code: string }) {
  const [SyntaxHighlighter, setSyntaxHighlighter] = useState<any>(null);
  const [hlStyle, setHlStyle] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      import("react-syntax-highlighter"),
      import("react-syntax-highlighter/dist/esm/styles/hljs/github"),
    ]).then(([mod, styleMod]) => {
      setSyntaxHighlighter(() => mod.Light);
      setHlStyle(styleMod.default);
    });
  }, []);

  if (!SyntaxHighlighter || !hlStyle) {
    return (
      <div className="flex-1 overflow-auto bg-[#f6f8fa]">
        <pre className="min-h-full p-6 text-sm leading-relaxed text-zinc-800 font-mono whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f6f8fa]">
      <SyntaxHighlighter
        language={hlLang(language)}
        style={hlStyle}
        showLineNumbers
        lineNumberStyle={{ color: "#94a3b8", minWidth: "2.5em", paddingRight: "1em", userSelect: "none" }}
        customStyle={{ margin: 0, padding: "1.5rem", background: "#f6f8fa", fontSize: "0.8125rem", lineHeight: "1.6", minHeight: "100%" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
