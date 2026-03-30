"use client";

/**
 * Requirements Table Component
 * Editable table for managing project requirements
 * Requirements: 25.1, 25.2, 25.4, 25.5
 */

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface Requirement {
  id: string;
  req_id: string; // REQ_UNIQUE_ID
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
  onUpdate: (id: string, field: keyof Requirement, value: string) => void;
  onCreate: () => void;
  onEditDetails: (requirement: Requirement) => void;
}

type SortField = keyof Requirement;
type SortDirection = "asc" | "desc";

export default function RequirementsTable({
  requirements,
  onUpdate,
  onCreate,
  onEditDetails,
}: RequirementsTableProps) {
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: keyof Requirement;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [sortField, setSortField] = useState<SortField>("req_id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filters, setFilters] = useState({
    type: "",
    priority: "",
    status: "",
  });

  // Debounced update handler
  const handleCellEdit = useCallback(
    (id: string, field: keyof Requirement, value: string) => {
      onUpdate(id, field, value);
      setEditingCell(null);
    },
    [onUpdate],
  );

  // Start editing a cell
  const startEdit = (
    id: string,
    field: keyof Requirement,
    currentValue: string,
  ) => {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // Save edit
  const saveEdit = () => {
    if (editingCell) {
      handleCellEdit(editingCell.id, editingCell.field, editValue);
    }
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort requirements
  const filteredAndSortedRequirements = useMemo(() => {
    let filtered = requirements;

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter((req) => req.type === filters.type);
    }
    if (filters.priority) {
      filtered = filtered.filter((req) => req.priority === filters.priority);
    }
    if (filters.status) {
      filtered = filtered.filter((req) => req.status === filters.status);
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [requirements, filters, sortField, sortDirection]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">All Types</option>
            <option value="functional">Functional</option>
            <option value="non-functional">Non-Functional</option>
          </select>
        </div>
        <div className="flex-1">
          <select
            value={filters.priority}
            onChange={(e) =>
              setFilters({ ...filters, priority: e.target.value })
            }
            className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex-1">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="validated">Validated</option>
            <option value="implemented">Implemented</option>
          </select>
        </div>
        <Button onClick={onCreate}>Add Requirement</Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
                onClick={() => handleSort("req_id")}
              >
                ID{" "}
                {sortField === "req_id" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
                onClick={() => handleSort("title")}
              >
                Title{" "}
                {sortField === "title" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
                onClick={() => handleSort("type")}
              >
                Type{" "}
                {sortField === "type" && (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
                onClick={() => handleSort("priority")}
              >
                Priority{" "}
                {sortField === "priority" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
                onClick={() => handleSort("status")}
              >
                Status{" "}
                {sortField === "status" &&
                  (sortDirection === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {filteredAndSortedRequirements.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-zinc-600 dark:text-zinc-400"
                >
                  No requirements found
                </td>
              </tr>
            ) : (
              filteredAndSortedRequirements.map((req) => (
                <tr
                  key={req.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                    {req.req_id}
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50 cursor-pointer"
                    onClick={() => startEdit(req.id, "title", req.title)}
                  >
                    {editingCell?.id === req.id &&
                    editingCell?.field === "title" ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      req.title || (
                        <span className="text-zinc-400">Click to edit</span>
                      )
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-sm cursor-pointer"
                    onClick={() => startEdit(req.id, "type", req.type)}
                  >
                    {editingCell?.id === req.id &&
                    editingCell?.field === "type" ? (
                      <select
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          handleCellEdit(req.id, "type", e.target.value);
                        }}
                        onBlur={cancelEdit}
                        className="h-8 w-full rounded-4xl border border-input bg-input/30 px-2 text-sm"
                      >
                        <option value="functional">Functional</option>
                        <option value="non-functional">Non-Functional</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          req.type === "functional"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        }`}
                      >
                        {req.type}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-sm cursor-pointer"
                    onClick={() => startEdit(req.id, "priority", req.priority)}
                  >
                    {editingCell?.id === req.id &&
                    editingCell?.field === "priority" ? (
                      <select
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          handleCellEdit(req.id, "priority", e.target.value);
                        }}
                        onBlur={cancelEdit}
                        className="h-8 w-full rounded-4xl border border-input bg-input/30 px-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          req.priority === "high"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : req.priority === "medium"
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {req.priority}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-sm cursor-pointer"
                    onClick={() => startEdit(req.id, "status", req.status)}
                  >
                    {editingCell?.id === req.id &&
                    editingCell?.field === "status" ? (
                      <select
                        value={editValue}
                        onChange={(e) => {
                          setEditValue(e.target.value);
                          handleCellEdit(req.id, "status", e.target.value);
                        }}
                        onBlur={cancelEdit}
                        className="h-8 w-full rounded-4xl border border-input bg-input/30 px-2 text-sm"
                      >
                        <option value="draft">Draft</option>
                        <option value="validated">Validated</option>
                        <option value="implemented">Implemented</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          req.status === "implemented"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : req.status === "validated"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {req.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Button
                      onClick={() => onEditDetails(req)}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
