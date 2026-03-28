/**
 * Auth Callback Route
 * Handles email confirmation and other auth callbacks from Supabase
 * Requirements: 1.1, 1.2
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the dashboard or specified next URL
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If there's an error or no code, redirect to login with error
  return NextResponse.redirect(
    new URL("/login?error=Could not verify email", requestUrl.origin),
  );
}
