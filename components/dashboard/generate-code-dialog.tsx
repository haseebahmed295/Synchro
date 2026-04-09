"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface DiagramOption {
  id: string;
  content: {
    diagram_metadata?: { name?: string; type?: string };
  };
}

interface GenerateCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagrams: DiagramOption[];
  onSuccess: (artifacts: any[]) => void;
}

const LANGUAGES = [
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
] as const;

type Language = (typeof LANGUAGES)[number]["value"];

export function GenerateCodeDialog({
  open,
  onOpenChange,
  diagrams,
  onSuccess,
}: GenerateCodeDialogProps) {
  const [diagramId, setDiagramId] = useState<string>(diagrams[0]?.id ?? "");
  const [language, setLanguage] = useState<Language>("typescript");
  const [framework, setFramework] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!diagramId) {
      setError("Please select a diagram.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/implementer/diagram-to-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagramArtifactId: diagramId,
          language,
          framework: framework.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Generation failed");
      }
      onSuccess(data.codeArtifacts ?? []);
      onOpenChange(false);
      // reset
      setFramework("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Code</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Diagram selector */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="diagram-select">Diagram</Label>
            {diagrams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No diagrams available. Create a diagram first.
              </p>
            ) : (
              <select
                id="diagram-select"
                value={diagramId}
                onChange={(e) => setDiagramId(e.target.value)}
                className="rounded-lg border border-border bg-input/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {diagrams.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.content?.diagram_metadata?.name || d.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <Label>Language</Label>
            <div className="flex gap-3">
              {LANGUAGES.map((lang) => (
                <label
                  key={lang.value}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="language"
                    value={lang.value}
                    checked={language === lang.value}
                    onChange={() => setLanguage(lang.value)}
                    className="accent-primary"
                  />
                  {lang.label}
                </label>
              ))}
            </div>
          </div>

          {/* Framework */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="framework-input">
              Framework{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="framework-input"
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              placeholder="e.g. nextjs, fastapi, spring"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || diagrams.length === 0}
          >
            {loading ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
