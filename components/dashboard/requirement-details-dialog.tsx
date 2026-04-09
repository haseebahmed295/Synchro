"use client";

import { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDependency,
  deleteDependency,
  wouldCreateCycle,
  DEP_LABELS,
  type DepType,
  type RequirementDependency,
} from "@/lib/api/dependencies";

export interface RequirementDetails {
  id: string;
  req_id: string;
  title: string;
  description: string;
  type: "functional" | "non-functional";
  priority: "low" | "medium" | "high";
  status: "draft" | "validated" | "implemented";
  links?: string[];
  tags?: string[];
}

interface RequirementDetailsDialogProps {
  requirement: RequirementDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (requirement: RequirementDetails) => void;
  // All requirements in the project for dependency linking
  allRequirements: RequirementDetails[];
  // All existing dependencies for cycle detection
  dependencies: RequirementDependency[];
  onDependencyCreated: (dep: RequirementDependency) => void;
  onDependencyDeleted: (depId: string) => void;
}

export function RequirementDetailsDialog({
  requirement,
  open,
  onOpenChange,
  onSave,
  allRequirements,
  dependencies,
  onDependencyCreated,
  onDependencyDeleted,
}: RequirementDetailsDialogProps) {
  const [formData, setFormData] = useState<RequirementDetails | null>(null);
  const [depsOpen, setDepsOpen] = useState(false);
  const [showAddDep, setShowAddDep] = useState(false);

  useEffect(() => {
    if (requirement) {
      setFormData(requirement);
      setDepsOpen(false);
    }
  }, [requirement]);

  if (!formData) return null;

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  // Dependencies where this requirement is the source
  const myDeps = dependencies.filter((d) => d.source_requirement_id === formData.id);
  // Dependencies where this requirement is the target (reverse view)
  const incomingDeps = dependencies.filter((d) => d.target_requirement_id === formData.id);

  const selectClass = "h-9 w-full rounded-md border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
  const textareaClass = "w-full min-h-[100px] rounded-md border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-y";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl w-full max-h-[85vh] !flex flex-col z-[200]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{formData.req_id}</span>
              <span className="text-base font-semibold">{formData.title || "Untitled"}</span>
            </DialogTitle>
            <DialogDescription>Edit requirement details and manage dependencies</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 pb-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter requirement title" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <textarea id="description" value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description" className={textareaClass} />
            </div>

            {/* Type / Priority / Status */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className={selectClass}>
                  <option value="functional">Functional</option>
                  <option value="non-functional">Non-Functional</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <select value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className={selectClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className={selectClass}>
                  <option value="draft">Draft</option>
                  <option value="validated">Validated</option>
                  <option value="implemented">Implemented</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" value={formData.tags?.join(", ") || ""}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                placeholder="authentication, security, api" />
            </div>

            {/* ── Dependencies collapsible ── */}
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setDepsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {depsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  Dependencies
                  {(myDeps.length + incomingDeps.length) > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {myDeps.length + incomingDeps.length}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {depsOpen ? "Collapse" : "Expand"}
                </span>
              </button>

              {depsOpen && (
                <div className="border-t px-4 py-3 space-y-3">
                  {/* Outgoing */}
                  {myDeps.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This requirement…</p>
                      {myDeps.map((dep) => {
                        const target = allRequirements.find((r) => r.id === dep.target_requirement_id);
                        return (
                          <DepRow key={dep.id} dep={dep} req={target} direction="outgoing"
                            onDelete={() => onDependencyDeleted(dep.id)}
                            onDeleteConfirm={async () => { await deleteDependency(dep.id); onDependencyDeleted(dep.id); }} />
                        );
                      })}
                    </div>
                  )}

                  {/* Incoming */}
                  {incomingDeps.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Other requirements…</p>
                      {incomingDeps.map((dep) => {
                        const source = allRequirements.find((r) => r.id === dep.source_requirement_id);
                        return (
                          <DepRow key={dep.id} dep={dep} req={source} direction="incoming"
                            onDelete={() => onDependencyDeleted(dep.id)}
                            onDeleteConfirm={async () => { await deleteDependency(dep.id); onDependencyDeleted(dep.id); }} />
                        );
                      })}
                    </div>
                  )}

                  {myDeps.length === 0 && incomingDeps.length === 0 && (
                    <p className="text-xs text-muted-foreground">No dependencies yet.</p>
                  )}

                  <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                    onClick={() => setShowAddDep(true)}>
                    <Plus className="size-3.5" />
                    Add Dependency
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dependency sub-dialog */}
      <AddDependencyDialog
        open={showAddDep}
        onOpenChange={setShowAddDep}
        sourceRequirement={formData}
        allRequirements={allRequirements}
        existingDeps={dependencies}
        onCreated={(dep) => { onDependencyCreated(dep); }}
      />
    </>
  );
}

// ── Dep row ──────────────────────────────────────────────────────────────────

function DepRow({ dep, req, direction, onDeleteConfirm }: {
  dep: RequirementDependency;
  req: RequirementDetails | undefined;
  direction: "outgoing" | "incoming";
  onDelete: () => void;
  onDeleteConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const info = DEP_LABELS[dep.dependency_type];
  const label = direction === "outgoing" ? info.label : info.inverse;

  const handleDelete = async () => {
    if (!confirm(`Remove this dependency?`)) return;
    setDeleting(true);
    try { await onDeleteConfirm(); } finally { setDeleting(false); }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
      <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
        {label}
      </span>
      <span className="font-mono text-xs text-muted-foreground shrink-0">{req?.req_id ?? "…"}</span>
      <span className="flex-1 truncate text-xs">{req?.title ?? "Unknown requirement"}</span>
      <button onClick={handleDelete} disabled={deleting}
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

// ── Add dependency dialog ─────────────────────────────────────────────────────

function AddDependencyDialog({ open, onOpenChange, sourceRequirement, allRequirements, existingDeps, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceRequirement: RequirementDetails;
  allRequirements: RequirementDetails[];
  existingDeps: RequirementDependency[];
  onCreated: (dep: RequirementDependency) => void;
}) {
  const [search, setSearch] = useState("");
  const [depType, setDepType] = useState<DepType>("blocks");
  const [selected, setSelected] = useState<RequirementDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [cycleWarning, setCycleWarning] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) { setSearch(""); setSelected(null); setCycleWarning(false); setDepType("blocks"); }
  }, [open]);

  const candidates = useMemo(() => {
    const alreadyLinked = new Set(
      existingDeps
        .filter((d) => d.source_requirement_id === sourceRequirement.id || d.target_requirement_id === sourceRequirement.id)
        .flatMap((d) => [d.source_requirement_id, d.target_requirement_id])
    );
    return allRequirements.filter((r) =>
      r.id !== sourceRequirement.id &&
      !alreadyLinked.has(r.id) &&
      (search === "" ||
        r.req_id.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase()))
    );
  }, [allRequirements, sourceRequirement.id, existingDeps, search]);

  const handleSelect = (req: RequirementDetails) => {
    setSelected(req);
    const cycle = wouldCreateCycle(sourceRequirement.id, req.id, existingDeps);
    setCycleWarning(cycle);
  };

  const handleAdd = async () => {
    if (!selected || cycleWarning) return;
    setSaving(true);
    try {
      const dep = await createDependency(sourceRequirement.id, selected.id, depType, existingDeps);
      onCreated(dep);
      onOpenChange(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create dependency");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] !flex flex-col z-[200]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add Dependency</DialogTitle>
          <DialogDescription>
            Link <span className="font-mono text-xs">{sourceRequirement.req_id}</span> to another requirement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1 pb-1">
          {/* Relationship type */}
          <div className="space-y-1.5">
            <Label>Relationship type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(DEP_LABELS) as [DepType, typeof DEP_LABELS[DepType]][]).map(([type, info]) => (
                <button key={type} type="button"
                  onClick={() => setDepType(type)}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${depType === type ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/40"}`}>
                  <p className="font-medium">{info.label}</p>
                  <p className="text-muted-foreground mt-0.5 leading-tight">{info.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="space-y-1.5">
            <Label>Search requirements</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID or title…" className="pl-8" autoFocus />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
            {candidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No requirements found</p>
            ) : candidates.map((req) => (
              <button key={req.id} type="button"
                onClick={() => handleSelect(req)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs transition-colors ${selected?.id === req.id ? "bg-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
                <span className={`font-mono text-xs shrink-0 ${selected?.id === req.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{req.req_id}</span>
                <span className="flex-1 truncate">{req.title}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${selected?.id === req.id ? "bg-white/20 text-primary-foreground" : req.priority === "high" ? "bg-red-100 text-red-700" : req.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                  {req.priority}
                </span>
              </button>
            ))}
          </div>

          {/* Cycle warning */}
          {cycleWarning && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
              <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">
                This would create a circular dependency chain and cannot be added.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selected || cycleWarning || saving}>
            {saving ? "Adding…" : "Add Dependency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
