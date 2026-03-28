-- Helper Functions and Utilities
-- This migration creates utility functions for the Synchro application
-- Requirements: 6.1, 6.2, 20.2, 20.3, 20.4

-- ============================================================================
-- OPTIMISTIC CONCURRENCY CONTROL (OCC) HELPER
-- ============================================================================
-- Requirements: 20.2, 20.3, 20.4

-- Function to apply JSON Patch with version check
CREATE OR REPLACE FUNCTION apply_artifact_patch(
    artifact_uuid UUID,
    json_patch JSONB,
    expected_version INTEGER
)
RETURNS TABLE(
    success BOOLEAN,
    new_version INTEGER,
    error_message TEXT
) AS $$
DECLARE
    rows_affected INTEGER;
    current_version INTEGER;
BEGIN
    -- Attempt to apply patch with version check
    UPDATE artifacts
    SET 
        content = jsonb_patch(content, json_patch),
        version = version + 1,
        updated_at = NOW()
    WHERE 
        id = artifact_uuid 
        AND version = expected_version;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    IF rows_affected = 0 THEN
        -- Check if artifact exists
        SELECT version INTO current_version
        FROM artifacts
        WHERE id = artifact_uuid;
        
        IF current_version IS NULL THEN
            RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Artifact not found'::TEXT;
        ELSE
            RETURN QUERY SELECT FALSE, current_version, 'Version conflict'::TEXT;
        END IF;
    ELSE
        -- Success - return new version
        SELECT version INTO current_version
        FROM artifacts
        WHERE id = artifact_uuid;
        
        RETURN QUERY SELECT TRUE, current_version, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION apply_artifact_patch IS 'Apply RFC 6902 JSON Patch with Optimistic Concurrency Control';

-- ============================================================================
-- TRACEABILITY GRAPH QUERIES
-- ============================================================================
-- Requirements: 14.1, 15.1, 16.1

-- Function to get all artifacts linked to a given artifact
CREATE OR REPLACE FUNCTION get_linked_artifacts(
    artifact_uuid UUID,
    max_depth INTEGER DEFAULT 1
)
RETURNS TABLE(
    artifact_id UUID,
    artifact_type artifact_type,
    link_path UUID[],
    depth INTEGER
) AS $$
WITH RECURSIVE artifact_graph AS (
    -- Base case: direct links
    SELECT 
        tl.target_id AS artifact_id,
        a.type AS artifact_type,
        ARRAY[artifact_uuid, tl.target_id] AS link_path,
        1 AS depth
    FROM traceability_links tl
    JOIN artifacts a ON a.id = tl.target_id
    WHERE tl.source_id = artifact_uuid
    
    UNION
    
    -- Recursive case: follow links up to max_depth
    SELECT 
        tl.target_id,
        a.type,
        ag.link_path || tl.target_id,
        ag.depth + 1
    FROM artifact_graph ag
    JOIN traceability_links tl ON tl.source_id = ag.artifact_id
    JOIN artifacts a ON a.id = tl.target_id
    WHERE 
        ag.depth < max_depth
        AND NOT (tl.target_id = ANY(ag.link_path)) -- Prevent cycles
)
SELECT * FROM artifact_graph;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_linked_artifacts IS 'Get all artifacts linked to a given artifact up to max_depth';

-- Function to detect circular dependencies
CREATE OR REPLACE FUNCTION detect_circular_dependencies(
    project_uuid UUID,
    link_types link_type[] DEFAULT ARRAY['implements', 'derives_from']::link_type[]
)
RETURNS TABLE(
    cycle_path UUID[],
    cycle_length INTEGER
) AS $$
WITH RECURSIVE dependency_graph AS (
    -- Base case: all links of specified types in project
    SELECT 
        tl.source_id,
        tl.target_id,
        ARRAY[tl.source_id, tl.target_id] AS path,
        1 AS depth
    FROM traceability_links tl
    JOIN artifacts a ON a.id = tl.source_id
    WHERE 
        a.project_id = project_uuid
        AND tl.link_type = ANY(link_types)
    
    UNION
    
    -- Recursive case: follow dependency chain
    SELECT 
        dg.source_id,
        tl.target_id,
        dg.path || tl.target_id,
        dg.depth + 1
    FROM dependency_graph dg
    JOIN traceability_links tl ON tl.source_id = dg.target_id
    JOIN artifacts a ON a.id = tl.source_id
    WHERE 
        a.project_id = project_uuid
        AND tl.link_type = ANY(link_types)
        AND dg.depth < 50 -- Prevent infinite recursion
        AND NOT (tl.target_id = ANY(dg.path)) -- Stop before creating cycle
)
SELECT 
    path || source_id AS cycle_path,
    array_length(path, 1) AS cycle_length
FROM dependency_graph
WHERE target_id = source_id; -- Cycle detected
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION detect_circular_dependencies IS 'Detect circular dependencies in traceability graph for specified link types';

-- ============================================================================
-- TRACEABILITY COVERAGE CALCULATIONS
-- ============================================================================
-- Requirements: 15.1, 15.2, 15.3, 15.4

-- Function to calculate traceability coverage for a project
CREATE OR REPLACE FUNCTION calculate_traceability_coverage(project_uuid UUID)
RETURNS TABLE(
    total_requirements INTEGER,
    requirements_with_diagrams INTEGER,
    requirements_with_code INTEGER,
    orphaned_code_files INTEGER,
    coverage_percentage NUMERIC
) AS $$
DECLARE
    total_reqs INTEGER;
    reqs_with_diagrams INTEGER;
    reqs_with_code INTEGER;
    orphaned_code INTEGER;
    coverage NUMERIC;
BEGIN
    -- Count total requirements
    SELECT COUNT(*) INTO total_reqs
    FROM artifacts
    WHERE project_id = project_uuid AND type = 'requirement';
    
    -- Count requirements with diagram links
    SELECT COUNT(DISTINCT a.id) INTO reqs_with_diagrams
    FROM artifacts a
    JOIN traceability_links tl ON tl.source_id = a.id
    JOIN artifacts target ON target.id = tl.target_id
    WHERE 
        a.project_id = project_uuid 
        AND a.type = 'requirement'
        AND target.type = 'diagram';
    
    -- Count requirements with code links
    SELECT COUNT(DISTINCT a.id) INTO reqs_with_code
    FROM artifacts a
    JOIN traceability_links tl ON tl.source_id = a.id
    JOIN artifacts target ON target.id = tl.target_id
    WHERE 
        a.project_id = project_uuid 
        AND a.type = 'requirement'
        AND target.type = 'code';
    
    -- Count orphaned code files (no requirement links)
    SELECT COUNT(*) INTO orphaned_code
    FROM artifacts a
    WHERE 
        a.project_id = project_uuid 
        AND a.type = 'code'
        AND NOT EXISTS (
            SELECT 1 FROM traceability_links tl
            JOIN artifacts req ON req.id = tl.source_id
            WHERE tl.target_id = a.id AND req.type = 'requirement'
        );
    
    -- Calculate coverage percentage
    IF total_reqs > 0 THEN
        coverage := (reqs_with_code::NUMERIC / total_reqs::NUMERIC) * 100;
    ELSE
        coverage := 0;
    END IF;
    
    RETURN QUERY SELECT 
        total_reqs,
        reqs_with_diagrams,
        reqs_with_code,
        orphaned_code,
        ROUND(coverage, 2);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_traceability_coverage IS 'Calculate traceability coverage metrics for a project';

-- ============================================================================
-- CHANGE LOG UTILITIES
-- ============================================================================
-- Requirements: 24.1, 24.2, 24.3

-- Function to get artifact history
CREATE OR REPLACE FUNCTION get_artifact_history(
    artifact_uuid UUID,
    limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
    change_id UUID,
    patch JSONB,
    applied_at TIMESTAMPTZ,
    applied_by agent_type,
    agent_type_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cl.id,
        cl.patch,
        cl.applied_at,
        cl.applied_by,
        cl.agent_type
    FROM change_log cl
    WHERE cl.artifact_id = artifact_uuid
    ORDER BY cl.applied_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_artifact_history IS 'Get change history for an artifact';

-- ============================================================================
-- STATISTICS AND MONITORING
-- ============================================================================

-- Function to get project statistics
CREATE OR REPLACE FUNCTION get_project_statistics(project_uuid UUID)
RETURNS TABLE(
    total_artifacts INTEGER,
    requirements_count INTEGER,
    diagrams_count INTEGER,
    code_count INTEGER,
    adr_count INTEGER,
    total_links INTEGER,
    last_updated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER AS total_artifacts,
        COUNT(*) FILTER (WHERE type = 'requirement')::INTEGER AS requirements_count,
        COUNT(*) FILTER (WHERE type = 'diagram')::INTEGER AS diagrams_count,
        COUNT(*) FILTER (WHERE type = 'code')::INTEGER AS code_count,
        COUNT(*) FILTER (WHERE type = 'adr')::INTEGER AS adr_count,
        (SELECT COUNT(*)::INTEGER FROM traceability_links tl
         JOIN artifacts a ON a.id = tl.source_id
         WHERE a.project_id = project_uuid) AS total_links,
        MAX(updated_at) AS last_updated
    FROM artifacts
    WHERE project_id = project_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_statistics IS 'Get aggregate statistics for a project';
