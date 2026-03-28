-- Row-Level Security (RLS) Policies
-- This migration configures security policies for all tables
-- Requirements: 1.2, 1.3

-- ============================================================================
-- ENABLE ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE traceability_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROJECTS TABLE RLS POLICIES
-- ============================================================================
-- Requirements: 1.2, 1.3

-- Policy: Users can view projects they own
CREATE POLICY "Users can view their own projects"
    ON projects
    FOR SELECT
    USING (auth.uid() = owner_id);

-- Policy: Users can create projects
CREATE POLICY "Users can create projects"
    ON projects
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can update their own projects
CREATE POLICY "Users can update their own projects"
    ON projects
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can delete their own projects
CREATE POLICY "Users can delete their own projects"
    ON projects
    FOR DELETE
    USING (auth.uid() = owner_id);

-- ============================================================================
-- ARTIFACTS TABLE RLS POLICIES
-- ============================================================================
-- Requirements: 1.2, 1.3
-- Access is based on project ownership

-- Policy: Users can view artifacts in their projects
CREATE POLICY "Users can view artifacts in their projects"
    ON artifacts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = artifacts.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Policy: Users can create artifacts in their projects
CREATE POLICY "Users can create artifacts in their projects"
    ON artifacts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = artifacts.project_id
            AND projects.owner_id = auth.uid()
        )
        AND auth.uid() = created_by
    );

-- Policy: Users can update artifacts in their projects
CREATE POLICY "Users can update artifacts in their projects"
    ON artifacts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = artifacts.project_id
            AND projects.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = artifacts.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Policy: Users can delete artifacts in their projects
CREATE POLICY "Users can delete artifacts in their projects"
    ON artifacts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = artifacts.project_id
            AND projects.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- CHANGE_LOG TABLE RLS POLICIES
-- ============================================================================
-- Requirements: 1.2, 1.3, 24.1
-- Access is based on artifact's project ownership

-- Policy: Users can view change logs for artifacts in their projects
CREATE POLICY "Users can view change logs in their projects"
    ON change_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM artifacts
            JOIN projects ON projects.id = artifacts.project_id
            WHERE artifacts.id = change_log.artifact_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Policy: Users can create change log entries for artifacts in their projects
CREATE POLICY "Users can create change logs in their projects"
    ON change_log
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM artifacts
            JOIN projects ON projects.id = artifacts.project_id
            WHERE artifacts.id = change_log.artifact_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Policy: Change logs are immutable (no updates or deletes by users)
-- Only SELECT and INSERT are allowed

-- ============================================================================
-- TRACEABILITY_LINKS TABLE RLS POLICIES
-- ============================================================================
-- Requirements: 1.2, 1.3, 14.1
-- Access is based on source artifact's project ownership

-- Policy: Users can view traceability links in their projects
CREATE POLICY "Users can view traceability links in their projects"
    ON traceability_links
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM artifacts
            JOIN projects ON projects.id = artifacts.project_id
            WHERE artifacts.id = traceability_links.source_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Policy: Users can create traceability links in their projects
CREATE POLICY "Users can create traceability links in their projects"
    ON traceability_links
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM artifacts AS source_artifact
            JOIN projects ON projects.id = source_artifact.project_id
            WHERE source_artifact.id = traceability_links.source_id
            AND projects.owner_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM artifacts AS target_artifact
            JOIN projects ON projects.id = target_artifact.project_id
            WHERE target_artifact.id = traceability_links.target_id
            AND projects.owner_id = auth.uid()
        )
        AND auth.uid() = created_by
    );

-- Policy: Users can update traceability links in their projects
CREATE POLICY "Users can update traceability links in their projects"
    ON traceability_links
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM artifacts
            JOIN projects ON projects.id = artifacts.project_id
            WHERE artifacts.id = traceability_links.source_id
            AND projects.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM artifacts
            JOIN projects ON projects.id = artifacts.project_id
            WHERE artifacts.id = traceability_links.source_id
            AND projects.owner_id = auth.uid()
        )
    );

-- Policy: Users can delete traceability links in their projects
CREATE POLICY "Users can delete traceability links in their projects"
    ON traceability_links
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM artifacts
            JOIN projects ON projects.id = artifacts.project_id
            WHERE artifacts.id = traceability_links.source_id
            AND projects.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Function to check if user has access to a project
CREATE OR REPLACE FUNCTION user_has_project_access(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_uuid
        AND owner_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible project IDs
CREATE OR REPLACE FUNCTION get_user_project_ids()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT id FROM projects
    WHERE owner_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_has_project_access IS 'Check if authenticated user has access to a project';
COMMENT ON FUNCTION get_user_project_ids IS 'Get all project IDs accessible by authenticated user';
