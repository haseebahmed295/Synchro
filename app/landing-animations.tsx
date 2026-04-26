"use client";

import { motion } from "framer-motion";
import { FileText, LayoutTemplate, Code2, ArrowRightLeft } from "lucide-react";
import React from "react";

export function MotionDiv({ children, className, delay = 0, y = 20 }: { children: React.ReactNode, className?: string, delay?: number, y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FeatureCard({ icon, title, description, delay = 0 }: { icon: React.ReactNode, title: string, description: string, delay?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={{ y: -5 }}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card/50 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md dark:bg-zinc-900/50"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{title}</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export function AnimatedArrow() {
  return (
    <motion.div
      animate={{ x: [0, 5, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="text-primary/50"
    >
      <ArrowRightLeft className="size-5" />
    </motion.div>
  );
}
