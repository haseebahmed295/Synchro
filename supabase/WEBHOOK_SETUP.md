# Supabase Webhook Setup Guide

This guide explains how to configure Supabase webhooks to trigger AI agent processing when artifacts are modified.

## Prerequisites

- Supabase Cloud project created
- Next.js application deployed to Vercel (or accessible via public URL)
- Database migrations applied (including `20260328000001_setup_webhooks.sql`)

## Step 1: Generate Webhook Secret

Generate a secure random string to use as your webhook secret:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this secret - you'll need it in the next steps.

## Step 2: Configure Environment Variables

Add the webhook secret to your environment variables:

### Local Development (.env.local)
```env
SUPABASE_WEBHOOK_SECRET=your_generated_secret_here
```

### Vercel Deployment
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add `SUPABASE_WEBHOOK_SECRET` with your generated secret
4. Redeploy your application

## Step 3: Configure Webhook in Supabase Dashboard

### Option A: Using Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Navigate to **Database** → **Webhooks**
3. Click **Create a new hook**
4. Configure the webhook:
   - **Name**: `artifact-changes`
   - **Table**: `artifacts`
   - **Events**: Select all three:
     - ☑ Insert
     - ☑ Update
     - ☑ Delete
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://your-domain.vercel.app/api/webhooks/supabase`
   - **HTTP Headers**:
     - Add header: `Content-Type: application/json`
     - Add header: `x-supabase-signature: [will be auto-generated]`
   - **Webhook Secret**: Paste your generated secret
5. Click **Create webhook**

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Create webhook using SQL
supabase db execute --file supabase/migrations/20260328000001_setup_webhooks.sql
```

Then configure the webhook through the dashboard as described in Option A.

## Step 4: Test Webhook Configuration

### Test 1: Health Check

```bash
curl https://your-domain.vercel.app/api/webhooks/supabase
```

Expected response:
```json
{
  "status": "ok",
  "message": "Supabase webhook endpoint is active",
  "timestamp": "2026-03-28T..."
}
```

### Test 2: Create Test Artifact

```sql
-- Run this in Supabase SQL Editor
INSERT INTO artifacts (project_id, type, content, created_by)
VALUES (
  (SELECT id FROM projects LIMIT 1),
  'requirement',
  '{"test": "webhook"}',
  auth.uid()
);
```

### Test 3: Check Logs

1. **Vercel Logs**: Check your Vercel deployment logs for webhook events
2. **Supabase Logs**: Check Database → Webhooks → View logs

You should see log entries like:
```
[Webhook Event] {
  timestamp: "2026-03-28T...",
  type: "INSERT",
  table: "artifacts",
  recordId: "..."
}
```

## Step 5: Verify Webhook Signature

The webhook endpoint automatically verifies signatures using HMAC-SHA256. If signature verification fails, you'll see:

```json
{
  "error": "Invalid webhook signature"
}
```

**Troubleshooting**:
- Ensure `SUPABASE_WEBHOOK_SECRET` matches the secret configured in Supabase
- Check that the secret is properly set in your deployment environment
- Verify the webhook is sending the `x-supabase-signature` header

## Webhook Payload Structure

The webhook sends the following payload:

```typescript
{
  type: 'INSERT' | 'UPDATE' | 'DELETE',
  table: 'artifacts',
  schema: 'public',
  record: {
    id: 'uuid',
    project_id: 'uuid',
    type: 'requirement' | 'diagram' | 'code' | 'adr',
    content: { /* jsonb */ },
    metadata: { /* jsonb */ },
    version: 1,
    created_at: 'timestamp',
    updated_at: 'timestamp',
    created_by: 'uuid'
  },
  old_record: { /* previous values for UPDATE/DELETE */ }
}
```

## Rate Limiting

The webhook endpoint is designed to handle:
- **Target**: 1,000 webhook events per minute per project (Requirement 28.3)
- **Retry Policy**: Supabase retries failed webhooks with exponential backoff (Requirement 18.4)
- **Max Retries**: 3 attempts before alerting (Requirement 18.5)

## Monitoring

### Check Webhook Status

```bash
# View recent webhook deliveries in Supabase Dashboard
# Database → Webhooks → artifact-changes → Logs
```

### Monitor Failed Deliveries

Failed webhook deliveries will:
1. Retry automatically (up to 3 times)
2. Log errors in Supabase webhook logs
3. Trigger monitoring alerts after 3 failed attempts

### Debug Mode

Enable detailed logging in development:

```env
NODE_ENV=development
```

This will log full webhook payloads to the console.

## Security Considerations

1. **Always verify webhook signatures** - The endpoint rejects requests without valid signatures
2. **Use HTTPS only** - Never configure webhooks with HTTP URLs
3. **Rotate secrets regularly** - Update webhook secret quarterly (Requirement 30.3)
4. **Monitor for abuse** - Check logs for unusual webhook patterns
5. **Rate limit protection** - The endpoint handles rate limiting automatically

## Next Steps

After webhook configuration:

1. **Phase 2**: Implement LangGraph agent orchestration (Task 7)
2. **Phase 2**: Connect webhook events to AI agents (Task 8-10)
3. **Phase 5**: Implement webhook retry and recovery (Task 27.1)

## Troubleshooting

### Webhook Not Triggering

1. Check trigger is enabled:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE 'artifact_%';
```

2. Verify webhook configuration in Supabase Dashboard
3. Check Vercel deployment is accessible
4. Review Supabase webhook logs for errors

### Signature Verification Failing

1. Verify secret matches in both locations
2. Check environment variable is loaded: `console.log(process.env.SUPABASE_WEBHOOK_SECRET)`
3. Ensure webhook is sending signature header
4. Try regenerating and reconfiguring the secret

### High Latency

1. Check Vercel function execution time
2. Review database query performance
3. Consider implementing webhook queue (Phase 5)
4. Monitor rate limiting metrics

## References

- [Supabase Webhooks Documentation](https://supabase.com/docs/guides/database/webhooks)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- Requirements: 18.1, 18.2, 18.3, 18.4, 18.5
