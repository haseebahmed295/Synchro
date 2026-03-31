"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateDiagramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateDiagram: (
    name: string,
    type: string,
    syncWithRequirements: boolean,
  ) => Promise<void>;
  isCreating: boolean;
}

export function CreateDiagramDialog({
  open,
  onOpenChange,
  onCreateDiagram,
  isCreating,
}: CreateDiagramDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("class");
  const [syncWithRequirements, setSyncWithRequirements] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onCreateDiagram(name.trim(), type, syncWithRequirements);
    
    // Reset form
    setName("");
    setType("class");
    setSyncWithRequirements(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Diagram</DialogTitle>
            <DialogDescription>
              Choose a diagram type and optionally sync with existing requirements
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Diagram Name</Label>
              <Input
                id="name"
                placeholder="e.g., System Architecture"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Diagram Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={isCreating}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
              >
                <option value="class">Class Diagram (UML)</option>
                <option value="sequence">Sequence Diagram (UML)</option>
                <option value="component">Component Diagram (UML)</option>
                <option value="deployment">Deployment Diagram (UML)</option>
                <option value="erd">Entity Relationship Diagram (ERD)</option>
                <option value="flowchart">Flowchart</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="sync"
                checked={syncWithRequirements}
                onChange={(e) => setSyncWithRequirements(e.target.checked)}
                disabled={isCreating}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <Label
                htmlFor="sync"
                className="text-sm font-normal cursor-pointer"
              >
                Generate diagram from existing requirements using AI
              </Label>
            </div>

            {syncWithRequirements && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                AI will analyze your project requirements and generate an initial
                diagram structure automatically.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? "Creating..." : "Create Diagram"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
