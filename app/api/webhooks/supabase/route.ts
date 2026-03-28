/**
 * Supabase Webhook Handler
 * Receives database change events and routes them to appropriate AI agents
 * Requirements: 18.1, 18.2
 */

import { type NextRequest, NextResponse } from "next/server";

// Webhook event types from Supabase
type WebhookEventType = "INSERT" | "UPDATE" | "DELETE";

// Webhook payload structure from Supabase
interface WebhookPayload {
  type: WebhookEventType;
  table: string;
  schema: string;
  record: Record<string, any> | null;
  old_record: Record<string, any> | null;
}

// Supabase webhook request body
interface SupabaseWebhookRequest {
  type: WebhookEventType;
  table: string;
  schema: string;
  record: Record<string, any> | null;
  old_record: Record<string, any> | null;
}

/**
 * Verify webhook signature from Supabase
 * Requirements: 18.1
 */
async function verifyWebhookSignature(
  request: NextRequest,
  body: string,
): Promise<boolean> {
  const signature = request.headers.get("x-supabase-signature");

  if (!signature) {
    console.warn("Missing webhook signature");
    return false;
  }

  // Get webhook secret from environment
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("SUPABASE_WEBHOOK_SECRET not configured");
    return false;
  }

  try {
    // Verify HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = hexToBytes(signature);
    const bodyBytes = encoder.encode(body);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as BufferSource,
      bodyBytes as BufferSource,
    );

    return isValid;
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return false;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Log webhook event for audit trail
 * Requirements: 18.2, 18.3
 */
async function logWebhookEvent(payload: WebhookPayload): Promise<void> {
  const timestamp = new Date().toISOString();

  console.log("[Webhook Event]", {
    timestamp,
    type: payload.type,
    table: payload.table,
    schema: payload.schema,
    recordId: payload.record?.id || payload.old_record?.id || "unknown",
  });

  // Log detailed payload in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Webhook Payload]", JSON.stringify(payload, null, 2));
  }
}

/**
 * Route webhook event to appropriate handler
 * Requirements: 18.2
 */
async function routeWebhookEvent(payload: WebhookPayload): Promise<void> {
  const { table, type, record, old_record } = payload;

  // Only process artifacts table events for now
  if (table !== "artifacts") {
    console.log(`[Webhook] Ignoring event for table: ${table}`);
    return;
  }

  // Log the event type and artifact type
  const artifactType = record?.type || old_record?.type;
  console.log(
    `[Webhook] Processing ${type} event for artifact type: ${artifactType}`,
  );

  // TODO: In Phase 2, dispatch to LangGraph agent mesh based on artifact type
  // For now, just log the event
  switch (type) {
    case "INSERT":
      console.log("[Webhook] New artifact created:", record?.id);
      break;
    case "UPDATE":
      console.log("[Webhook] Artifact updated:", record?.id);
      break;
    case "DELETE":
      console.log("[Webhook] Artifact deleted:", old_record?.id);
      break;
  }
}

/**
 * POST handler for Supabase webhooks
 * Requirements: 18.1, 18.2
 */
export async function POST(request: NextRequest) {
  try {
    // Read request body
    const body = await request.text();

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(request, body);

    if (!isValid) {
      console.error("[Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    // Parse webhook payload
    const payload: WebhookPayload = JSON.parse(body);

    // Validate payload structure
    if (!payload.type || !payload.table) {
      console.error("[Webhook] Invalid payload structure");
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    // Log the event
    await logWebhookEvent(payload);

    // Route to appropriate handler
    await routeWebhookEvent(payload);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Webhook processed successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET handler for health check
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Supabase webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
