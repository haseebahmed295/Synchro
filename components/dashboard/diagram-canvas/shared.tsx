"use client";

import { useState } from "react";

// ─── Context menu ──────────────────────────────────────────────────────────────

export type CtxTarget =
  | { kind: "node"; id: string; label: string; nodeType?: string }
  | { kind: "edge"; id: string; label: string };

export interface ContextMenuProps {
  x: number;
  y: number;
  target: CtxTarget;
  onDelete: (kind: "node" | "edge", id: string) => void;
  onEditLabel: (kind: "node" | "edge", id: string, current: string) => void;
  onEditColumns?: (id: string, label: string) => void;
  onAddChild?: (parentId: string, type: string, defaultLabel: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, target, onDelete, onEditLabel, onEditColumns, onAddChild, onClose }: ContextMenuProps) {
  const isErdNode = target.kind === "node" && target.nodeType === "entity";
  const isDevice = target.kind === "node" && (target.nodeType === "deploymentNode" || target.nodeType === "node");
  const isExecEnv = target.kind === "node" && target.nodeType === "executionEnvironment";

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={onClose} />
      <div style={{
        position: "fixed", left: x, top: y, zIndex: 1000,
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 180, overflow: "hidden",
        fontFamily: "system-ui, sans-serif", fontSize: 13,
      }}>
        <div style={{ padding: "6px 12px", borderBottom: "1px solid #f3f4f6", color: "#6b7280", fontSize: 11 }}>
          {target.kind === "node" ? "Node" : "Edge"}: {target.label || target.id.slice(0, 12)}
        </div>

        {isDevice && onAddChild && (
          <>
            <button
              onClick={() => { onAddChild(target.id, "executionEnvironment", "JVM"); onClose(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#065f46" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#d1fae5")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              ⚙️ Add Exec Environment
            </button>
            <button
              onClick={() => { onAddChild(target.id, "component", "MyService"); onClose(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#4c1d95" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#ede9fe")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              🧩 Add Component
            </button>
            <button
              onClick={() => { onAddChild(target.id, "artifact", "app.jar"); onClose(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#374151" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              📄 Add Artifact
            </button>
          </>
        )}
        {isExecEnv && onAddChild && (
          <>
            <button
              onClick={() => { onAddChild(target.id, "component", "MyService"); onClose(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#4c1d95" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#ede9fe")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              🧩 Add Component
            </button>
            <button
              onClick={() => { onAddChild(target.id, "artifact", "app.jar"); onClose(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#374151" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              📄 Add Artifact
            </button>
          </>
        )}

        <button
          onClick={() => { onEditLabel(target.kind, target.id, target.label); onClose(); }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#111827" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          ✏️ Edit label
        </button>
        {isErdNode && onEditColumns && (
          <button
            onClick={() => { onEditColumns(target.id, target.label); onClose(); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#111827" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            🗂️ Edit columns
          </button>
        )}
        <button
          onClick={() => { onDelete(target.kind, target.id); onClose(); }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          🗑️ Delete
        </button>
      </div>
    </>
  );
}

// ─── Edit label dialog ─────────────────────────────────────────────────────────

export interface EditLabelDialogProps {
  current: string;
  onSave: (label: string) => void;
  onClose: () => void;
}

export function EditLabelDialog({ current, onSave, onClose }: EditLabelDialogProps) {
  const [value, setValue] = useState(current);
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1001 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "#fff", borderRadius: 10, padding: 24, zIndex: 1002,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", minWidth: 320,
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: "#111827" }}>Edit Label</div>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave(value); if (e.key === "Escape") onClose(); }}
          style={{
            width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db",
            borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={() => onSave(value)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Save</button>
        </div>
      </div>
    </>
  );
}

// ─── ERD Column editor dialog ──────────────────────────────────────────────────

export interface ColumnEditorProps {
  tableName: string;
  columns: string[];
  onSave: (columns: string[]) => void;
  onClose: () => void;
}

export function ColumnEditorDialog({ tableName, columns, onSave, onClose }: ColumnEditorProps) {
  const [rows, setRows] = useState<string[]>(columns.length > 0 ? [...columns] : [""]);

  const update = (i: number, val: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? val : r)));

  const addRow = () => setRows((prev) => [...prev, ""]);

  const removeRow = (i: number) =>
    setRows((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const handleKeyDown = (e: React.KeyboardEvent, _i: number) => {
    if (e.key === "Enter") { e.preventDefault(); addRow(); }
    if (e.key === "Escape") onClose();
  };

  const handleSave = () => onSave(rows.filter((r) => r.trim() !== ""));

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1001 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "#fff", borderRadius: 10, padding: 24, zIndex: 1002,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", width: 420, maxHeight: "80vh",
        display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#111827" }}>
          Edit Columns — {tableName}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 14 }}>
          Format: <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>column_name: type</code>
          &nbsp;· Prefix with 🔑 for primary key
        </div>
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                autoFocus={i === rows.length - 1 && rows.length > 1}
                value={row}
                onChange={(e) => update(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                placeholder={i === 0 ? "🔑 id: integer" : "column_name: type"}
                style={{
                  flex: 1, padding: "6px 10px", border: "1.5px solid #d1d5db",
                  borderRadius: 6, fontSize: 12, outline: "none", fontFamily: "monospace",
                }}
              />
              <button
                onClick={() => removeRow(i)}
                style={{
                  width: 26, height: 26, borderRadius: 6, border: "1px solid #fca5a5",
                  background: "#fff", cursor: "pointer", color: "#dc2626", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >×</button>
            </div>
          ))}
        </div>
        <button
          onClick={addRow}
          style={{
            marginTop: 10, padding: "6px 0", borderRadius: 6, border: "1.5px dashed #d1d5db",
            background: "#f9fafb", cursor: "pointer", fontSize: 12, color: "#6b7280", width: "100%",
          }}
        >
          + Add column
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Save</button>
        </div>
      </div>
    </>
  );
}
