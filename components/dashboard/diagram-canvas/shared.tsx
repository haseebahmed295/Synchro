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
  onEditInterfaces?: (id: string, label: string, field: "provided" | "required") => void;
  onEditClassMembers?: (id: string, label: string, field: "attributes" | "methods") => void;
  onAddChild?: (parentId: string, type: string, defaultLabel: string) => void;
  onStartConnect?: (sourceId: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, target, onDelete, onEditLabel, onEditColumns, onEditInterfaces, onEditClassMembers, onAddChild, onStartConnect, onClose }: ContextMenuProps) {
  const isErdNode = target.kind === "node" && target.nodeType === "entity";
  const isDevice = target.kind === "node" && (target.nodeType === "deploymentNode" || target.nodeType === "node");
  const isExecEnv = target.kind === "node" && target.nodeType === "executionEnvironment";
  const isComponentNode = target.kind === "node" && target.nodeType === "componentDiagram";
  const isClassNode = target.kind === "node" && target.nodeType === "class";

  return (
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} />
      <div
        className="fixed z-[1000] min-w-[180px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md text-[13px]"
        style={{ left: x, top: y }}
      >
        <div className="px-3 py-1.5 border-b border-border text-muted-foreground text-[11px]">
          {target.kind === "node" ? "Node" : "Edge"}: {target.label || target.id.slice(0, 12)}
        </div>

        {isDevice && onAddChild && (
          <>
            <button
              onClick={() => { onAddChild(target.id, "executionEnvironment", "JVM"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent text-emerald-600 dark:text-emerald-400"
            >
              ⚙️ Add Exec Environment
            </button>
            <button
              onClick={() => { onAddChild(target.id, "component", "MyService"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent text-violet-600 dark:text-violet-400"
            >
              🧩 Add Component
            </button>
            <button
              onClick={() => { onAddChild(target.id, "artifact", "app.jar"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent"
            >
              📄 Add Artifact
            </button>
          </>
        )}
        {isExecEnv && onAddChild && (
          <>
            <button
              onClick={() => { onAddChild(target.id, "component", "MyService"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent text-violet-600 dark:text-violet-400"
            >
              🧩 Add Component
            </button>
            <button
              onClick={() => { onAddChild(target.id, "artifact", "app.jar"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent"
            >
              📄 Add Artifact
            </button>
          </>
        )}

        {isClassNode && onEditClassMembers && (
          <>
            <button
              onClick={() => { onEditClassMembers(target.id, target.label, "attributes"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent text-blue-600 dark:text-blue-400"
            >
              📋 Edit attributes
            </button>
            <button
              onClick={() => { onEditClassMembers(target.id, target.label, "methods"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent text-blue-600 dark:text-blue-400"
            >
              ⚙️ Edit methods
            </button>
          </>
        )}
        {target.kind === "node" && onStartConnect && (
          <button
            onClick={() => { onStartConnect(target.id); onClose(); }}
            className="block w-full text-left px-3.5 py-2 hover:bg-accent text-blue-600 dark:text-blue-400"
          >
            🔗 Connect from here
          </button>
        )}

        <button
          onClick={() => { onEditLabel(target.kind, target.id, target.label); onClose(); }}
          className="block w-full text-left px-3.5 py-2 hover:bg-accent"
        >
          ✏️ Edit label
        </button>
        {isErdNode && onEditColumns && (
          <button
            onClick={() => { onEditColumns(target.id, target.label); onClose(); }}
            className="block w-full text-left px-3.5 py-2 hover:bg-accent"
          >
            🗂️ Edit columns
          </button>
        )}
        {isComponentNode && onEditInterfaces && (
          <>
            <button
              onClick={() => { onEditInterfaces(target.id, target.label, "provided"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent text-emerald-600 dark:text-emerald-400"
            >
              ○ Edit provided interfaces
            </button>
            <button
              onClick={() => { onEditInterfaces(target.id, target.label, "required"); onClose(); }}
              className="block w-full text-left px-3.5 py-2 hover:bg-accent text-amber-600 dark:text-amber-400"
            >
              ◑ Edit required interfaces
            </button>
          </>
        )}
        <button
          onClick={() => { onDelete(target.kind, target.id); onClose(); }}
          className="block w-full text-left px-3.5 py-2 hover:bg-destructive/10 text-destructive"
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
      <div className="fixed inset-0 bg-black/50 z-[1001] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background text-foreground rounded-lg p-6 z-[1002] shadow-lg min-w-[320px]">
        <div className="font-semibold text-[15px] mb-3">Edit Label</div>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave(value); if (e.key === "Escape") onClose(); }}
          className="w-full px-3 py-2 border border-input bg-transparent rounded-md text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-input hover:bg-accent text-[13px]">Cancel</button>
          <button onClick={() => onSave(value)} className="px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] font-semibold">Save</button>
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
  mode?: "column" | "attribute" | "method" | "interface";
}

export function ColumnEditorDialog({ tableName, columns, onSave, onClose, mode = "column" }: ColumnEditorProps) {
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

  const isMethod = mode === "method";
  const isAttribute = mode === "attribute";
  const isInterface = mode === "interface";

  const title = isInterface ? tableName
    : isMethod ? `Edit Methods — ${tableName}`
    : isAttribute ? `Edit Attributes — ${tableName}`
    : `Edit Columns — ${tableName}`;

  const helperText = isInterface
    ? <>Format: <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>InterfaceName</code>&nbsp;— e.g. <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>IAuthService</code>, <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>IPaymentGateway</code></>
    : isMethod
    ? <>Format: <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>+&nbsp;methodName(param:&nbsp;Type):&nbsp;ReturnType</code>&nbsp;· Use +, -, # for visibility</>
    : isAttribute
    ? <>Format: <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>+&nbsp;name:&nbsp;Type</code>&nbsp;· Use +&nbsp;public, -&nbsp;private, #&nbsp;protected</>
    : <>Format: <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>column_name: type</code>&nbsp;· Prefix with 🔑 for primary key</>;

  const placeholder = (i: number) => isInterface
    ? (i === 0 ? "IAuthService" : "InterfaceName")
    : isMethod
    ? (i === 0 ? "+ calculateTotal(tax: Float): Float" : "+ methodName(param: Type): ReturnType")
    : isAttribute
    ? (i === 0 ? "+ id: Int" : "+ name: Type")
    : (i === 0 ? "🔑 id: integer" : "column_name: type");

  const addLabel = isInterface ? "+ Add Interface" : isMethod ? "+ Add Method" : isAttribute ? "+ Add Attribute" : "+ Add column";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[1001] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background text-foreground rounded-lg p-6 z-[1002] shadow-lg w-[460px] max-h-[80vh] flex flex-col">
        <div className="font-bold text-[15px] mb-1">
          {title}
        </div>
        <div className="text-[11px] text-muted-foreground mb-4">
          {helperText}
        </div>
        <div className="overflow-y-auto flex-1 flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input
                autoFocus={i === rows.length - 1 && rows.length > 1}
                value={row}
                onChange={(e) => update(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                placeholder={placeholder(i)}
                className="flex-1 px-2.5 py-1.5 border border-input bg-transparent rounded-md text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
              />
              <button
                onClick={() => removeRow(i)}
                className="w-7 h-7 rounded-md border border-destructive/30 hover:bg-destructive/10 text-destructive text-sm flex items-center justify-center shrink-0"
              >×</button>
            </div>
          ))}
        </div>
        <button
          onClick={addRow}
          className="mt-2.5 py-1.5 rounded-md border-2 border-dashed border-input hover:bg-accent text-xs text-muted-foreground w-full transition-colors"
        >
          {addLabel}
        </button>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-3.5 py-1.5 rounded-md border border-input hover:bg-accent text-[13px]">Cancel</button>
          <button onClick={handleSave} className="px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] font-semibold">Save</button>
        </div>
      </div>
    </>
  );
}
