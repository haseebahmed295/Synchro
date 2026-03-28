"use client";

/**
 * Create Project Button
 * Opens modal dialog for creating new projects
 * Requirements: 2.1, 2.3
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import CreateProjectDialog from "./create-project-dialog";

export default function CreateProjectButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = (projectId: string) => {
    setOpen(false);
    router.push(`/dashboard/projects/${projectId}`);
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create Project</Button>
      <CreateProjectDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
