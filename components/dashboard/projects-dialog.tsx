"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteProject } from "@/lib/api/projects";
import { formatDistanceToNow } from "@/lib/utils/date";

interface Project {
  id: string;
  name: string;
  description: string | null;
  version: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

interface ProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (project: Project) => void;
  onProjectsChange: (projects: Project[]) => void;
}

export function ProjectsDialog({
  open,
  onOpenChange,
  projects,
  selectedProjectId,
  onSelectProject,
  onProjectsChange,
}: ProjectsDialogProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); return; }

      const { data, error: err } = await supabase
        .from("projects")
        .insert({ name, description: description || null, version: "0.1.0", owner_id: user.id })
        .select()
        .single();

      if (err) { setError(err.message); return; }
      if (data) {
        const updated = [data, ...projects];
        onProjectsChange(updated);
        onSelectProject(data);
        setName("");
        setDescription("");
        setShowCreate(false);
        onOpenChange(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Delete "${project.name}"? This will remove all requirements, diagrams, and artifacts.`)) return;
    setDeletingId(project.id);
    try {
      await deleteProject(project.id);
      const updated = projects.filter((p) => p.id !== project.id);
      onProjectsChange(updated);
      if (selectedProjectId === project.id) {
        onSelectProject(updated[0] ?? null as any);
      }
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="size-4" />
            Projects
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {projects.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No projects yet. Create one to get started.
            </p>
          )}
          {projects.map((project) => (
            <div
              key={project.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                selectedProjectId === project.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
              onClick={() => { onSelectProject(project); onOpenChange(false); }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.name}</p>
                {project.description && (
                  <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  v{project.version} · updated {formatDistanceToNow(project.updated_at)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(project); }}
                disabled={deletingId === project.id}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete project"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

          {showCreate && (
            <form onSubmit={handleCreate} className="rounded-lg border border-dashed p-4 space-y-3">
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="proj-name" className="text-xs">Project Name</Label>
                <Input
                  id="proj-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Project"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-desc" className="text-xs">Description (optional)</Label>
                <Input
                  id="proj-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={creating || !name.trim()}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {!showCreate && (
          <div className="pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-3.5" />
              New Project
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
