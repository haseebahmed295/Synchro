/**
 * Supabase Client for Browser/Client Components
 * Use this in Client Components (components with 'use client' directive)
 * Requirements: 1.1, 30.1
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
