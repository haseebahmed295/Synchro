# Supabase Migrations for Synchro

This directory contains SQL migration files for the Synchro CASE tool database schema.

## Migration Files

### 20260327000001_create_core_schema.sql
Creates the core database tables and indexes:
- `projects` - Project metadata and versioning
- `artifacts` - All project artifacts (requirements, diagrams, code, ADRs)
- `change_log` - Audit trail for all modifications
- `traceability_links` - Relationships between artifacts
- Indexes for performance optimization
- Automatic timestamp update triggers

**Requirements Covered**: 1.1, 2.1, 2.2, 14.1, 24.2, 27.1, 30.1

### 20260327000002_create_rls_policies.sql
Configures Row-Level Security (RLS) policies:
- Project-level access control
- Artifact access based on project ownership
- Change log access restrictions
- Traceability link access control
- Helper functions for RLS checks

**Requirements Covered**: 1.2, 1.3, 14.1, 24.1

### 20260327000003_create_helper_functions.sql
Creates utility functions:
- `apply_artifact_patch()` - Optimistic Concurrency Control for JSON Patches
- `get_linked_artifacts()` - Traverse traceability graph
- `detect_circular_dependencies()` - Find cycles in dependency graph
- `calculate_traceability_coverage()` - Coverage metrics
- `get_artifact_history()` - Change history retrieval
- `get_project_statistics()` - Project aggregate statistics

**Requirements Covered**: 6.1, 6.2, 14.1, 15.1, 15.2, 15.3, 15.4, 16.1, 20.2, 20.3, 20.4, 24.1, 24.2, 24.3

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended for Manual Application)

1. Log in to your Supabase project at https://app.supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy and paste the contents of each migration file in order:
   - First: `20260327000001_create_core_schema.sql`
   - Second: `20260327000002_create_rls_policies.sql`
   - Third: `20260327000003_create_helper_functions.sql`
5. Click **Run** for each migration
6. Verify success in the **Database** → **Tables** section

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply all migrations
supabase db push

# Or apply migrations individually
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20260327000001_create_core_schema.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20260327000002_create_rls_policies.sql
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20260327000003_create_helper_functions.sql
```

### Option 3: Direct PostgreSQL Connection

```bash
# Using psql with connection string from Supabase dashboard
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260327000001_create_core_schema.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260327000002_create_rls_policies.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20260327000003_create_helper_functions.sql
```

## Verification

After applying migrations, verify the schema:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

## Database Schema Overview

```
projects
├── id (UUID, PK)
├── name (VARCHAR)
├── description (TEXT)
├── version (VARCHAR)
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
└── owner_id (UUID, FK → auth.users)

artifacts
├── id (UUID, PK)
├── project_id (UUID, FK → projects)
├── type (ENUM: requirement, diagram, code, adr)
├── content (JSONB)
├── metadata (JSONB)
├── version (INTEGER) -- OCC version counter
├── created_at (TIMESTAMPTZ)
├── updated_at (TIMESTAMPTZ)
└── created_by (UUID, FK → auth.users)

change_log
├── id (UUID, PK)
├── artifact_id (UUID, FK → artifacts)
├── patch (JSONB) -- RFC 6902 JSON Patch
├── applied_at (TIMESTAMPTZ)
├── applied_by (ENUM: user, analyst, architect, implementer, judge)
└── agent_type (VARCHAR)

traceability_links
├── id (UUID, PK)
├── source_id (UUID, FK → artifacts)
├── target_id (UUID, FK → artifacts)
├── link_type (ENUM: implements, derives_from, validates, references)
├── confidence (FLOAT 0.0-1.0)
├── created_at (TIMESTAMPTZ)
└── created_by (UUID, FK → auth.users)
```

## Key Features

### Optimistic Concurrency Control (OCC)
The `version` field in the `artifacts` table enables safe concurrent updates:
```sql
-- Example usage
SELECT apply_artifact_patch(
    'artifact-uuid',
    '[{"op": "replace", "path": "/title", "value": "New Title"}]'::jsonb,
    1  -- expected version
);
```

### Stable Key JSON Schema
The `content` JSONB field uses stable keys to prevent index-shift errors during AI updates. See design document for schema details.

### Traceability Graph
The `traceability_links` table creates a directed graph of artifact relationships, enabling:
- Coverage analysis
- Circular dependency detection
- Impact analysis
- Bidirectional sync

### Audit Trail
The `change_log` table records all modifications using RFC 6902 JSON Patches, enabling:
- Full history replay
- Revert functionality
- Compliance auditing

## Next Steps

After applying migrations:

1. Update `.env.local` with your Supabase credentials
2. Install Supabase packages: `npm install @supabase/supabase-js @supabase/ssr`
3. Configure Supabase client in Next.js (see task 2.1)
4. Test database connection and RLS policies
5. Proceed to task 3: Next.js frontend foundation
