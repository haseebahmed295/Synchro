/**
 * Home Page
 * Landing page that redirects to dashboard or login
 * Requirements: 1.1, 2.1
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getUser();

  // Redirect authenticated users to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Synchro
        </h1>
        <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
          AI-Native CASE Tool for Modern Software Development
        </p>
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          Automate transitions between SDLC phases with intelligent agents that
          maintain bidirectional traceability between Requirements, Design, and
          Code.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
