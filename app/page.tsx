/**
 * Home Page - Landing page for Synchro
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/session";
import { MotionDiv, FeatureCard, AnimatedArrow } from "./landing-animations";
import { FileText, LayoutTemplate, Code2 } from "lucide-react";

export default async function Home() {
  const user = await getUser();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Synchro
        </span>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard">
              <Button size="sm">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-4 py-24 text-center relative z-10">
        <MotionDiv delay={0.1} className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-muted-foreground mb-8 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          AI-Native CASE Tool
        </MotionDiv>

        <MotionDiv delay={0.2}>
          <h1 className="max-w-4xl text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground leading-tight">
            Requirements to code,{" "}
            <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">always in sync</span>
          </h1>
        </MotionDiv>

        <MotionDiv delay={0.3}>
          <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
            Synchro uses intelligent agents to automate transitions between SDLC phases — keeping your requirements, diagrams, and code bidirectionally linked.
          </p>
        </MotionDiv>

        <MotionDiv delay={0.4} className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          {user ? (
            <Link href="/dashboard">
              <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/signup">
                <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105">Start for free</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="rounded-full px-8 bg-background/50 backdrop-blur-sm transition-all hover:scale-105">Sign in</Button>
              </Link>
            </>
          )}
        </MotionDiv>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-zinc-50/50 dark:bg-zinc-950/50 px-8 py-24">
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<FileText className="size-6" />}
            title="Intelligent Ingestion"
            description="Paste text, upload PDFs or images — the Analyst agent extracts and structures requirements automatically."
            delay={0.1}
          />
          <FeatureCard
            icon={<LayoutTemplate className="size-6" />}
            title="Auto-Generated Diagrams"
            description="The Architect agent turns requirements into UML class, sequence, and ERD diagrams in seconds."
            delay={0.2}
          />
          <FeatureCard
            icon={<Code2 className="size-6" />}
            title="Code Generation"
            description="The Implementer generates TypeScript, Python, or Java from your diagrams, with full traceability back to requirements."
            delay={0.3}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="px-8 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
            One source of truth
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-12">
            Every change propagates. Edit a requirement and diagrams update. Modify a diagram and requirements stay in sync. No more drift between docs and code.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap text-sm font-medium mt-12">
            <FlowStep label="Requirements" icon={<FileText className="size-4 text-primary" />} />
            <AnimatedArrow />
            <FlowStep label="Diagrams" icon={<LayoutTemplate className="size-4 text-primary" />} />
            <AnimatedArrow />
            <FlowStep label="Code" icon={<Code2 className="size-4 text-primary" />} />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-primary/70">Bidirectional Updates</p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-900 dark:bg-zinc-950 px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to ship faster?</h2>
        <p className="text-zinc-400 mb-8 max-w-md mx-auto">
          Stop manually keeping docs and code in sync. Let Synchro handle it.
        </p>
        <Link href="/signup">
          <Button size="lg" variant="secondary">Get started free</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-6 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Synchro. All rights reserved.
      </footer>
    </div>
  );
}

function FlowStep({ label, icon }: { label: string, icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-foreground shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
      {icon}
      {label}
    </div>
  );
}
