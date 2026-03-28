"use client";

/**
 * Dashboard Navigation
 * Top navigation bar with user menu and logout
 * Requirements: 1.1, 1.2
 */

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface DashboardNavProps {
  user: User;
}

export default function DashboardNav({ user }: DashboardNavProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Synchro
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user.email}
            </span>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
