"use client";

/**
 * Requirements Table Component
 * Editable table with linked-nodes chips and group-by support
 */

import React, { useCallback, useMemo, useState } from "react";
import { AlertTriangle, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TraceabilityLinkRow } from "@/lib/api/links";
import type { RequirementDependency } from "@/lib/api/dependencies";
import type { Diagram } from "@/lib/types/diagram";

export interface Requirement {
  id: string;
  req_id: string;
  title: string;
  type: "functional" | "non-functional";
  priority: "low" | "medium" | "high";
  status: "draft" | "validated" | "implemented";
  description?: string;
  links?: string[];
  tags?: string[];
}

interface RequirementsTableProps {
  requirements: Requirement[];
  links: TraceabilityLinkRow[];
  diagrams: Diagram[];
  dependencies: RequirementDependency[];
  onUpdate: (id: string, field: keyof Requirement, value: string) => void;
  onCreate: () => void;
  onEditDetails: (requirement: Requirement) => void;
  onDelete: (id: string) => void;
  onNavigateToNode: (diagramId: string, nodeId: string) => void;
}

type SortField = keyof Requirement;
type SortDirection = "asc" | "desc";
type GroupBy = "none" | "type" | "priority" | "status";

export default function RequirementsTable({
  requirements,
  links,
  diagrams,
  dependencies,
  onUpdate,
  onCreate,
  onEditDetails,
  onDelete,
  onNavigateToNode,
}: RequirementsTableProps) {
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof Requirement } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [sortField, setSortField] = useState<SortField>("req_id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [filters, setFilters] = useState({ type: "", priority: "", status: "" });

  const handleCellEdit = useCallback((id: string, field: keyof Requirement, value: string) => {
    onUpdate(id, field, value);
    setEditingCell(null);
  }, [onUpdate]);

  const startEdit = (id: string, field: keyof Requirement, currentValue: string) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };
  const saveEdit = () => { if (editingCell) handleCellEdit(editingCell.id, editingCell.field, editValue); };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDirection("asc"); }
  };

  // Dep count per requirement (outgoing + incoming)
  const reqDepCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const dep of dependencies) {
      map.set(dep.source_requirement_id, (map.get(dep.source_requirement_id) ?? 0) + 1);
      map.set(dep.target_requirement_id, (map.get(dep.target_requirement_id) ?? 0) + 1);
    }
    return map;
  }, [dependencies]);

  // Build a fast lookup: requirementId → linked nodes
  const reqToNodes = useMemo(() => {
    const map = new Map<string, Array<{ nodeId: string; nodeLabel: string; diagramId: string }>>();
    for (const link of links) {
      if (!link.target_node_id) continue;
      const diagramId = link.target_id;
      const diagram = diagrams.find((d) => d.id === diagramId);
      const node = diagram?.nodes.find((n) => n.id === link.target_node_id);
      const entry = { nodeId: link.target_node_id, nodeLabel: node?.data.label ?? link.target_node_id, diagramId };
      const existing = map.get(link.source_id) ?? [];
      existing.push(entry);
      map.set(link.source_id, existing);
    }
    return map;
  }, [links, diagrams]);

  const filteredAndSorted = useMemo(() => {
    let filtered = requirements;
    if (filters.type) filtered = filtered.filter((r) => r.type === filters.type);
    if (filters.priority) filtered = filtered.filter((r) => r.priority === filters.priority);
    if (filters.status) filtered = filtered.filter((r) => r.status === filters.status);
    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? ""; const bv = b[sortField] ?? "";
      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [requirements, filters, sortField, sortDirection]);

  // Group the sorted list
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ label: null, rows: filteredAndSorted }];
    const groups = new Map<string, Requirement[]>();
    for (const req of filteredAndSorted) {
      const key = req[groupBy] as string;
      const g = groups.get(key) ?? [];
      g.push(req);
      groups.set(key, g);
    }
    return Array.from(groups.entries()).map(([label, rows]) => ({ label, rows }));
  }, [filteredAndSorted, groupBy]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th className="cursor-pointer px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50 whitespace-nowrap" onClick={() => handleSort(field)}>
      {label} {sortField === field && (sortDirection === "asc" ? "↑" : "↓")}
    </th>
  );

  const renderRow = (req: Requirement) => {
    const nodeChips = reqToNodes.get(req.id) ?? [];
    const isUnlinked = nodeChips.length === 0;
    const depCount = reqDepCount.get(req.id) ?? 0;

    return (
      <tr key={req.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
        <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {isUnlinked && (
              <span title="No diagram nodes linked">
                <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
              </span>
            )}
            <span>{req.req_id}</span>
            {depCount > 0 && (
              <span
                title={`${depCount} dependenc${depCount === 1 ? "y" : "ies"}`}
                className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
              >
                <GitBranch className="size-2.5" />
                {depCount}
              </span>
            )}
          </div>
        </td>

        {/* Title */}
        <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 cursor-pointer min-w-[180px]"
          onClick={() => startEdit(req.id, "title", req.title)}>
          {editingCell?.id === req.id && editingCell?.field === "title" ? (
            <Input value={editValue} onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
              autoFocus className="h-8" />
          ) : req.title || <span className="text-zinc-400">Click to edit</span>}
        </td>

        {/* Linked nodes chips */}
        <td className="px-4 py-3 text-sm max-w-[220px]">
          <div className="flex flex-wrap gap-1">
            {nodeChips.length === 0 ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : nodeChips.map((chip) => (
              <button key={`${chip.diagramId}-${chip.nodeId}`}
                onClick={() => onNavigateToNode(chip.diagramId, chip.nodeId)}
                className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors"
                title={`Go to ${chip.nodeLabel} in diagram`}>
                {chip.nodeLabel}
              </button>
            ))}
          </div>
        </td>

        {/* Type */}
        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => startEdit(req.id, "type", req.type)}>
          {editingCell?.id === req.id && editingCell?.field === "type" ? (
            <select value={editValue} onChange={(e) => { setEditValue(e.target.value); handleCellEdit(req.id, "type", e.target.value); }} onBlur={cancelEdit}
              className="h-8 w-full rounded border border-input bg-input/30 px-2 text-sm">
              <option value="functional">Functional</option>
              <option value="non-functional">Non-Functional</option>
            </select>
          ) : (
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${req.type === "functional" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
              {req.type}
            </span>
          )}
        </td>

        {/* Priority */}
        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => startEdit(req.id, "priority", req.priority)}>
          {editingCell?.id === req.id && editingCell?.field === "priority" ? (
            <select value={editValue} onChange={(e) => { setEditValue(e.target.value); handleCellEdit(req.id, "priority", e.target.value); }} onBlur={cancelEdit}
              className="h-8 w-full rounded border border-input bg-input/30 px-2 text-sm">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          ) : (
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${req.priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : req.priority === "medium" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
              {req.priority}
            </span>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => startEdit(req.id, "status", req.status)}>
          {editingCell?.id === req.id && editingCell?.field === "status" ? (
            <select value={editValue} onChange={(e) => { setEditValue(e.target.value); handleCellEdit(req.id, "status", e.target.value); }} onBlur={cancelEdit}
              className="h-8 w-full rounded border border-input bg-input/30 px-2 text-sm">
              <option value="draft">Draft</option><option value="validated">Validated</option><option value="implemented">Implemented</option>
            </select>
          ) : (
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${req.status === "implemented" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : req.status === "validated" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"}`}>
              {req.status}
            </span>
          )}
        </td>

        <td className="px-4 py-3 text-sm">
          <div className="flex gap-2">
            <Button onClick={() => onEditDetails(req)} size="sm" variant="outline">Edit</Button>
            <Button onClick={() => { if (confirm(`Delete "${req.req_id}"?`)) onDelete(req.id); }} size="sm" variant="destructive">Delete</Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters + group-by */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring">
          <option value="">All Types</option>
          <option value="functional">Functional</option>
          <option value="non-functional">Non-Functional</option>
        </select>
        <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring">
          <option value="">All Priorities</option>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option><option value="validated">Validated</option><option value="implemented">Implemented</option>
        </select>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="h-9 rounded-md border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring">
          <option value="none">No Grouping</option>
          <option value="type">Group by Type</option>
          <option value="priority">Group by Priority</option>
          <option value="status">Group by Status</option>
        </select>
        <Button onClick={onCreate} className="ml-auto">Add Requirement</Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <SortHeader field="req_id" label="ID" />
              <SortHeader field="title" label="Title" />
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50">Linked Nodes</th>
              <SortHeader field="type" label="Type" />
              <SortHeader field="priority" label="Priority" />
              <SortHeader field="status" label="Status" />
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {filteredAndSorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-600 dark:text-zinc-400">No requirements found</td></tr>
            ) : grouped.map(({ label, rows }) => (
              <React.Fragment key={label ?? "ungrouped"}>
                {label && (
                  <tr className="bg-zinc-100 dark:bg-zinc-900/60">
                    <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {label} <span className="font-normal normal-case">({rows.length})</span>
                    </td>
                  </tr>
                )}
                {rows.map(renderRow)}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
