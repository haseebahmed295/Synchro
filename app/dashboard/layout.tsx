/**
 * Dashboard Layout
 * Protected layout for authenticated users
 * Requirements: 1.1, 1.2, 2.1
 */

import { redirect } from "next/navigation";
import DashboardNav from "@/components/dashboard/nav";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const supabase = await createClient();

  // Verify user still has valid session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav user={user} />
      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">{children}</main>
    </div>
  );
}
