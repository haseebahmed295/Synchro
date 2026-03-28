/**
 * Authentication Session Helpers
 * Utilities for managing user sessions and authentication state
 * Requirements: 1.1, 1.2
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Get the current authenticated user session
 * Returns null if no session exists
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get the current authenticated user
 * Returns null if no user is authenticated
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Require authentication for a page
 * Redirects to login if user is not authenticated
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Redirect authenticated users away from auth pages
 * Useful for login/signup pages
 */
export async function redirectIfAuthenticated() {
  const user = await getUser();
  if (user) {
    redirect("/dashboard");
  }
}
