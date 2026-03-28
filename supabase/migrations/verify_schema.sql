-- Verification Queries for Synchro Database Schema
-- Run these queries after applying migrations to verify everything is set up correctly

-- ============================================================================
-- 1. VERIFY TABLES EXIST
-- ============================================================================

SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('projects', 'artifacts', 'change_log', 'traceability_links')
ORDER BY table_name;

-- Expected: 4 rows (projects, artifacts, change_log, traceability_links)

-- ============================================================================
-- 2. VERIFY ENUM TYPES
-- ============================================================================

SELECT 
    t.typname AS enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('artifact_type', 'link_type', 'agent_type')
GROUP BY t.typname
ORDER BY t.typname;

-- Expected:
-- artifact_type: requirement, diagram, code, adr
-- link_type: implements, derives_from, validates, references
-- agent_type: user, analyst, architect, implementer, judge

-- ============================================================================
-- 3. VERIFY ROW-LEVEL SECURITY IS ENABLED
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN ('projects', 'artifacts', 'change_log', 'traceability_links')
ORDER BY tablename;

-- Expected: All tables should have rowsecurity = true

-- ============================================================================
-- 4. VERIFY RLS POLICIES
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected: Multiple policies per table for SELECT, INSERT, UPDATE, DELETE

-- ============================================================================
-- 5. VERIFY INDEXES
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
    AND tablename IN ('projects', 'artifacts', 'change_log', 'traceability_links')
ORDER BY tablename, indexname;

-- Expected: Multiple indexes per table including foreign keys and frequently queried fields

-- ============================================================================
-- 6. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================================================

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('projects', 'artifacts', 'change_log', 'traceability_links')
ORDER BY tc.table_name, kcu.column_name;

-- Expected: Foreign keys for owner_id, project_id, artifact_id, source_id, target_id, created_by

-- ============================================================================
-- 7. VERIFY CHECK CONSTRAINTS
-- ============================================================================

SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('projects', 'artifacts', 'change_log', 'traceability_links')
ORDER BY tc.table_name, tc.constraint_name;

-- Expected: Constraints for version > 0, confidence range, no self-reference, etc.

-- ============================================================================
-- 8. VERIFY TRIGGERS
-- ============================================================================

SELECT 
    event_object_table AS table_name,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table IN ('projects', 'artifacts')
ORDER BY event_object_table, trigger_name;

-- Expected: update_projects_updated_at, update_artifacts_updated_at

-- ============================================================================
-- 9. VERIFY HELPER FUNCTIONS
-- ============================================================================

SELECT 
    routine_name,
    routine_type,
    data_type AS return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    AND routine_name IN (
        'apply_artifact_patch',
        'get_linked_artifacts',
        'detect_circular_dependencies',
        'calculate_traceability_coverage',
        'get_artifact_history',
        'get_project_statistics',
        'user_has_project_access',
        'get_user_project_ids',
        'update_updated_at_column'
    )
ORDER BY routine_name;

-- Expected: 9 functions

-- ============================================================================
-- 10. VERIFY TABLE COLUMNS
-- ============================================================================

-- Projects table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
ORDER BY ordinal_position;

-- Artifacts table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'artifacts'
ORDER BY ordinal_position;

-- Change log table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'change_log'
ORDER BY ordinal_position;

-- Traceability links table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'traceability_links'
ORDER BY ordinal_position;

-- ============================================================================
-- 11. TEST HELPER FUNCTIONS (Optional - requires test data)
-- ============================================================================

-- Test apply_artifact_patch function (will fail without data, but verifies function exists)
-- SELECT * FROM apply_artifact_patch(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     '[{"op": "replace", "path": "/test", "value": "test"}]'::jsonb,
--     1
-- );

-- Test get_project_statistics function
-- SELECT * FROM get_project_statistics('00000000-0000-0000-0000-000000000000'::uuid);

-- Test calculate_traceability_coverage function
-- SELECT * FROM calculate_traceability_coverage('00000000-0000-0000-0000-000000000000'::uuid);

-- ============================================================================
-- 12. VERIFY EXTENSIONS
-- ============================================================================

SELECT 
    extname AS extension_name,
    extversion AS version
FROM pg_extension
WHERE extname = 'uuid-ossp';

-- Expected: uuid-ossp extension installed

-- ============================================================================
-- SUMMARY QUERY
-- ============================================================================

SELECT 
    'Tables' AS category,
    COUNT(*)::text AS count
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('projects', 'artifacts', 'change_log', 'traceability_links')

UNION ALL

SELECT 
    'Indexes' AS category,
    COUNT(*)::text AS count
FROM pg_indexes 
WHERE schemaname = 'public'
    AND tablename IN ('projects', 'artifacts', 'change_log', 'traceability_links')

UNION ALL

SELECT 
    'RLS Policies' AS category,
    COUNT(*)::text AS count
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'Functions' AS category,
    COUNT(*)::text AS count
FROM information_schema.routines 
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'

UNION ALL

SELECT 
    'Triggers' AS category,
    COUNT(*)::text AS count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table IN ('projects', 'artifacts')

ORDER BY category;

-- ============================================================================
-- EXPECTED SUMMARY RESULTS
-- ============================================================================
-- Tables: 4
-- Indexes: 20+
-- RLS Policies: 16+
-- Functions: 9
-- Triggers: 2
