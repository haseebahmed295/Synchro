"use client";

/**
 * Idea to Requirements Dialog
 * Describe your idea or paste notes — AI generates structured requirements automatically.
 */

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
import { Label } from "@/components/ui/label";

interface IdeaToRequirementsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onRequirementCreated: (requirement: any) => void;
  onDependencyCreated: (dependency: any) => void;
  onGenerationStart: () => void;
  onGenerationComplete: () => void;
}

export function IdeaToRequirementsDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  onRequirementCreated,
  onDependencyCreated,
  onGenerationStart,
  onGenerationComplete,
}: IdeaToRequirementsDialogProps) {
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerate = async () => {
    if (!text.trim()) {
      alert("Please describe your idea first");
      return;
    }

    setIsProcessing(true);
    onOpenChange(false);
    onGenerationStart();

    try {
      const response = await fetch("/api/analyst/ingest-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), projectId }),
      });

      if (!response.ok) throw new Error("Failed to start generation");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let requirementCount = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "requirement") { requirementCount = data.count; onRequirementCreated(data.requirement); }
                else if (data.type === "dependency") { onDependencyCreated(data.dependency); }
              } catch {}
            }
          }
        }
      }

      setText("");
      onSuccess();
      onGenerationComplete();
      setTimeout(() => alert(`Created ${requirementCount} requirement${requirementCount !== 1 ? "s" : ""}!`), 500);
    } catch (error) {
      alert(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      onGenerationComplete();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Requirements from Idea</DialogTitle>
          <DialogDescription>
            Describe your idea, paste notes, or write what the system should do. AI will generate structured requirements automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="idea-text">Your Idea</Label>
            <textarea
              id="idea-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe your idea or project...&#10;&#10;Example: I want to build a task management app where users can create projects, assign tasks to team members, set deadlines, and track progress. It should send email notifications and support file attachments."
              className="w-full min-h-[300px] rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-y font-mono"
              disabled={isProcessing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isProcessing || !text.trim()}>
            {isProcessing ? "Generating..." : "Generate Requirements"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
