/**
 * Dashboard Page — single-page app shell
 */

import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/dashboard/app-shell";

export default async function DashboardPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <AppShell
      initialProjects={projects || []}
      userEmail={user.email ?? ""}
      userId={user.id}
    />
  );
}
