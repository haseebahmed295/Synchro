"use client";

/**
 * Project List Component
 * Displays grid of user projects with navigation
 * Requirements: 2.1, 2.3
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/lib/api/projects";
import { formatDistanceToNow } from "@/lib/utils/date";

interface Project {
  id: string;
  name: string;
  description: string | null;
  version: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

interface ProjectListProps {
  projects: Project[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This will delete all requirements, diagrams, and other artifacts.`)) {
      return;
    }

    setDeletingId(projectId);
    try {
      await deleteProject(projectId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert(`Failed to delete project: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          No projects yet
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Get started by creating your first project
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <div
          key={project.id}
          className="group rounded-lg border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="block"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                {project.name}
              </h3>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                v{project.version}
              </span>
            </div>

            {project.description && (
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {project.description}
              </p>
            )}

            <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
              Updated {formatDistanceToNow(project.updated_at)}
            </div>
          </Link>

          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              onClick={(e) => {
                e.preventDefault();
                handleDelete(project.id, project.name);
              }}
              variant="destructive"
              size="sm"
              disabled={deletingId === project.id}
              className="w-full"
            >
              {deletingId === project.id ? "Deleting..." : "Delete Project"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
