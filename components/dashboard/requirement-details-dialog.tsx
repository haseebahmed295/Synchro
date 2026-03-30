"use client";

/**
 * Requirement Details Dialog
 * Modal for viewing and editing full requirement details
 */

import { useEffect, useState } from "react";
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
}

export function RequirementDetailsDialog({
  requirement,
  open,
  onOpenChange,
  onSave,
}: RequirementDetailsDialogProps) {
  const [formData, setFormData] = useState<RequirementDetails | null>(null);

  useEffect(() => {
    if (requirement) {
      setFormData(requirement);
    }
  }, [requirement]);

  if (!formData) return null;

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Requirement Details</DialogTitle>
          <DialogDescription>
            Edit the full details of this requirement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Requirement ID (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="req_id">Requirement ID</Label>
            <Input
              id="req_id"
              value={formData.req_id}
              disabled
              className="bg-zinc-100 dark:bg-zinc-800"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter requirement title"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter detailed requirement description"
              className="w-full min-h-[120px] rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-y"
            />
          </div>

          {/* Type, Priority, Status in a row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "functional" | "non-functional",
                  })
                }
                className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="functional">Functional</option>
                <option value="non-functional">Non-Functional</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as "low" | "medium" | "high",
                  })
                }
                className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as
                      | "draft"
                      | "validated"
                      | "implemented",
                  })
                }
                className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="draft">Draft</option>
                <option value="validated">Validated</option>
                <option value="implemented">Implemented</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={formData.tags?.join(", ") || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="e.g., authentication, security, api"
            />
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Label htmlFor="links">Related Links (one per line)</Label>
            <textarea
              id="links"
              value={formData.links?.join("\n") || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  links: e.target.value.split("\n").filter(Boolean),
                })
              }
              placeholder="Enter related requirement IDs or URLs"
              className="w-full min-h-[80px] rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-y"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
