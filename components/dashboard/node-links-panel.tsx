"use client";

import { Link2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TraceabilityLinkRow } from "@/lib/api/links";
import type { Requirement } from "@/components/dashboard/requirements-table";

interface NodeLinksPanelProps {
  nodeId: string;
  nodeLabel: string;
  links: TraceabilityLinkRow[];           // all project links, filtered here
  requirements: Requirement[];            // all project requirements
  onAddLink: (requirementId: string) => void;
  onDeleteLink: (linkId: string) => void;
  onNavigateToRequirement: (requirementId: string) => void;
  onClose: () => void;
}

export function NodeLinksPanel({
  nodeId,
  nodeLabel,
  links,
  requirements,
  onAddLink,
  onDeleteLink,
  onNavigateToRequirement,
  onClose,
}: NodeLinksPanelProps) {
  const nodeLinks = links.filter((l) => l.target_node_id === nodeId);
  const linkedReqIds = new Set(nodeLinks.map((l) => l.source_id));
  const unlinkedRequirements = requirements.filter((r) => !linkedReqIds.has(r.id));
  const isOrphan = nodeLinks.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold truncate">{nodeLabel}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs shrink-0 ml-2">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Orphan warning */}
        {isOrphan && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Orphaned component — no requirement is linked to this node.
            </p>
          </div>
        )}

        {/* Linked requirements */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Linked Requirements ({nodeLinks.length})
          </p>
          {nodeLinks.length === 0 ? (
            <p className="text-xs text-muted-foreground">None yet.</p>
          ) : (
            <div className="space-y-2">
              {nodeLinks.map((link) => {
                const req = requirements.find((r) => r.id === link.source_id);
                return (
                  <div key={link.id} className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onNavigateToRequirement(link.source_id)}
                        className="text-xs font-medium text-primary hover:underline text-left truncate block w-full"
                      >
                        {req?.req_id ?? link.source_id.slice(0, 8)}
                      </button>
                      <p className="text-xs text-muted-foreground truncate">{req?.title ?? "Unknown requirement"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{link.link_type}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{Math.round(link.confidence * 100)}% confidence</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteLink(link.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Remove link"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add link */}
        {unlinkedRequirements.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Add Link
            </p>
            <div className="space-y-1">
              {unlinkedRequirements.map((req) => (
                <button
                  key={req.id}
                  onClick={() => onAddLink(req.id)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
                >
                  <Plus className="size-3 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">{req.req_id}</span>
                  <span className="truncate text-muted-foreground">{req.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
