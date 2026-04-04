"use client";

/**
 * Text to Requirements Dialog
 * Allows users to paste raw text and convert it to structured requirements using AI
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

interface TextToRequirementsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onRequirementCreated: (requirement: any) => void;
  onDependencyCreated: (dependency: any) => void;
  onGenerationStart: () => void;
  onGenerationComplete: () => void;
}

export function TextToRequirementsDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  onRequirementCreated,
  onDependencyCreated,
  onGenerationStart,
  onGenerationComplete,
}: TextToRequirementsDialogProps) {
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConvert = async () => {
    if (!text.trim()) {
      alert("Please enter some text to convert");
      return;
    }

    setIsProcessing(true);
    
    // Close dialog and notify parent that generation started
    onOpenChange(false);
    onGenerationStart();
    
    try {
      const response = await fetch("/api/analyst/ingest-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start conversion");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let requirementCount = 0;

      if (reader) {
        console.log("[Frontend] Starting to read SSE stream...");
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("[Frontend] Stream complete");
            break;
          }

          const chunk = decoder.decode(value);
          console.log("[Frontend] Received chunk:", chunk);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log("[Frontend] Parsed SSE event:", data);

                if (data.type === "requirement") {
                  requirementCount = data.count;
                  onRequirementCreated(data.requirement);
                } else if (data.type === "dependency") {
                  onDependencyCreated(data.dependency);
                } else if (data.type === "complete") {
                  console.log(`[Frontend] Complete: ${data.count} requirements, ${data.depsCreated} dependencies`);
                } else if (data.type === "error") {
                  console.error("[Frontend] Error:", data.error);
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
                console.log("[Frontend] Parse error (incomplete chunk):", e);
              }
            }
          }
        }
      }

      setText("");
      onSuccess();
      
      // Notify parent that generation is complete
      onGenerationComplete();
      
      // Show success message
      setTimeout(() => {
        alert(
          `Successfully created ${requirementCount} requirement${requirementCount !== 1 ? "s" : ""}!`,
        );
      }, 500);
    } catch (error) {
      console.error("Failed to convert text:", error);
      alert(
        `Failed to convert text: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      onGenerationComplete(); // Also complete on error
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Text to Requirements</DialogTitle>
          <DialogDescription>
            Paste raw text, meeting notes, or documentation. AI will extract
            structured requirements automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="raw-text">Raw Text</Label>
            <textarea
              id="raw-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Example:&#10;&#10;The system must allow users to log in with email and password.&#10;Users should be able to reset their password via email.&#10;The login page must load in under 2 seconds.&#10;All passwords must be encrypted using bcrypt.&#10;&#10;Paste your requirements text here..."
              className="w-full min-h-[300px] rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-y font-mono"
              disabled={isProcessing}
            />
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-2">Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
              <li>Write each requirement on a separate line or paragraph</li>
              <li>Be specific and clear about what the system should do</li>
              <li>Include both functional and non-functional requirements</li>
              <li>Mention priorities if known (high, medium, low)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isProcessing || !text.trim()}>
            {isProcessing ? "Converting..." : "Convert to Requirements"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
