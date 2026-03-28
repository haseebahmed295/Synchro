# Supabase Setup Guide for Synchro

This guide walks you through setting up Supabase Cloud for the Synchro CASE tool.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Node.js and npm installed
- Git repository initialized

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in project details:
   - **Name**: `synchro` (or your preferred name)
   - **Database Password**: Generate a strong password and save it securely
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Free tier is sufficient for development
4. Click "Create new project"
5. Wait 2-3 minutes for project provisioning

## Step 2: Get API Credentials

1. In your Supabase project dashboard, click on the **Settings** icon (gear) in the left sidebar
2. Navigate to **API** section
3. Copy the following values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")
   - **service_role** key (under "Project API keys" - keep this secret!)

## Step 3: Configure Environment Variables

1. Open `.env.local` in your project root
2. Replace the placeholder values with your actual Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
```

3. Save the file
4. **IMPORTANT**: Never commit `.env.local` to version control (it's already in `.gitignore`)

## Step 4: Install Dependencies

The Supabase packages are already in `package.json`. Install them:

```bash
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase JavaScript client
- `@supabase/ssr` - Server-side rendering utilities for Next.js

## Step 5: Apply Database Migrations

You have three options to apply the migrations:

### Option A: Supabase Dashboard (Recommended for First-Time Setup)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase/migrations/20260327000001_create_core_schema.sql`
5. Copy the entire contents and paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. Wait for success message
8. Repeat steps 3-7 for:
   - `supabase/migrations/20260327000002_create_rls_policies.sql`
   - `supabase/migrations/20260327000003_create_helper_functions.sql`

### Option B: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Option C: Direct PostgreSQL Connection

```bash
# Get connection string from Supabase Dashboard > Settings > Database
# Then run each migration file:

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260327000001_create_core_schema.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260327000002_create_rls_policies.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260327000003_create_helper_functions.sql
```

## Step 6: Verify Database Setup

1. In Supabase Dashboard, go to **Database** → **Tables**
2. You should see 4 tables:
   - `projects`
   - `artifacts`
   - `change_log`
   - `traceability_links`

3. Click on **SQL Editor** and run the verification queries from `supabase/migrations/verify_schema.sql`

4. Expected results:
   - ✅ 4 tables created
   - ✅ 20+ indexes created
   - ✅ 16+ RLS policies enabled
   - ✅ 9 helper functions created
   - ✅ 2 triggers created

## Step 7: Enable Realtime (Optional but Recommended)

1. Go to **Database** → **Replication** in Supabase Dashboard
2. Enable replication for these tables:
   - `projects`
   - `artifacts`
   - `change_log`
   - `traceability_links`
3. This enables real-time subscriptions for collaborative features

## Step 8: Test Database Connection

Create a simple test to verify everything works:

```typescript
// test-supabase.ts
import { createClient } from './lib/supabase/client'

async function testConnection() {
  const supabase = createClient()
  
  // Test connection
  const { data, error } = await supabase
    .from('projects')
    .select('count')
    .single()
  
  if (error) {
    console.error('Connection failed:', error)
  } else {
    console.log('✅ Supabase connection successful!')
  }
}

testConnection()
```

Run the test:
```bash
npx tsx test-supabase.ts
```

## Step 9: Configure Authentication (For Task 3.2)

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (enabled by default)
3. Optional: Enable additional providers (Google, GitHub, etc.)
4. Configure email templates under **Authentication** → **Email Templates**
5. Set up redirect URLs under **Authentication** → **URL Configuration**:
   - Site URL: `http://localhost:3000` (development)
   - Redirect URLs: `http://localhost:3000/auth/callback`

## Step 10: Set Up Webhooks (For Task 4)

Webhooks will be configured later in Phase 1, Task 4. For now, note that you'll need:

1. A deployed Next.js API route (e.g., `/api/webhooks/supabase`)
2. Webhook configuration in **Database** → **Webhooks**
3. Triggers on `artifacts` table for INSERT, UPDATE, DELETE events

## Troubleshooting

### Issue: "Invalid API key" error

**Solution**: 
- Verify you copied the correct keys from Supabase Dashboard
- Ensure no extra spaces or quotes in `.env.local`
- Restart your Next.js dev server after updating `.env.local`

### Issue: "relation does not exist" error

**Solution**:
- Migrations were not applied correctly
- Re-run migrations in order
- Check SQL Editor for error messages

### Issue: RLS policies blocking queries

**Solution**:
- Ensure you're authenticated (use `supabase.auth.signUp()` or `signIn()`)
- Check that `auth.uid()` matches the `owner_id` in your queries
- For testing, you can temporarily disable RLS (not recommended for production)

### Issue: Connection timeout

**Solution**:
- Check your internet connection
- Verify Supabase project is not paused (free tier pauses after 1 week of inactivity)
- Check Supabase status page: https://status.supabase.com

## Next Steps

After completing this setup:

1. ✅ Task 2.1: Create Supabase Cloud project and configure connection - **COMPLETE**
2. ✅ Task 2.2: Create core database tables - **COMPLETE**
3. ✅ Task 2.2: Configure Row-Level Security policies - **COMPLETE**
4. ✅ Task 2.3: Set up database indexes - **COMPLETE**
5. → Proceed to **Task 3**: Set up Next.js frontend foundation

## Useful Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Guide](https://supabase.com/docs/guides/realtime)
- [Database Functions Guide](https://supabase.com/docs/guides/database/functions)

## Security Best Practices

1. ✅ Never commit `.env.local` to version control
2. ✅ Use `NEXT_PUBLIC_` prefix only for client-safe variables
3. ✅ Keep `SUPABASE_SERVICE_ROLE_KEY` secret (server-side only)
4. ✅ Enable RLS on all tables
5. ✅ Use prepared statements to prevent SQL injection
6. ✅ Rotate API keys quarterly (Requirement 30.3)
7. ✅ Enable 2FA on your Supabase account
8. ✅ Use strong database passwords
9. ✅ Monitor API usage in Supabase Dashboard
10. ✅ Set up alerts for suspicious activity

## Database Schema Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     SYNCHRO DATABASE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  projects                    artifacts                      │
│  ├── id (PK)                 ├── id (PK)                   │
│  ├── name                    ├── project_id (FK)           │
│  ├── description             ├── type (enum)               │
│  ├── version                 ├── content (jsonb)           │
│  ├── created_at              ├── metadata (jsonb)          │
│  ├── updated_at              ├── version (OCC)             │
│  └── owner_id (FK)           ├── created_at                │
│                              ├── updated_at                │
│  change_log                  └── created_by (FK)           │
│  ├── id (PK)                                               │
│  ├── artifact_id (FK)        traceability_links            │
│  ├── patch (jsonb)           ├── id (PK)                   │
│  ├── applied_at              ├── source_id (FK)            │
│  ├── applied_by              ├── target_id (FK)            │
│  └── agent_type              ├── link_type (enum)          │
│                              ├── confidence                │
│                              ├── created_at                │
│                              └── created_by (FK)           │
└─────────────────────────────────────────────────────────────┘
```

---

**Status**: Task 2 setup complete! You're ready to build the Next.js frontend.
