-- Synchro Database Schema Migration
-- This migration creates the core tables for the Synchro CASE tool
-- Requirements: 1.1, 2.1, 2.2, 14.1, 24.2, 30.1

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE artifact_type AS ENUM ('requirement', 'diagram', 'code', 'adr');
CREATE TYPE link_type AS ENUM ('implements', 'derives_from', 'validates', 'references');
CREATE TYPE agent_type AS ENUM ('user', 'analyst', 'architect', 'implementer', 'judge');

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
-- Stores project metadata and versioning information
-- Requirements: 2.1, 2.2

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '0.1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    CONSTRAINT projects_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

-- Add comment for documentation
COMMENT ON TABLE projects IS 'Container for related artifacts with shared context';
COMMENT ON COLUMN projects.version IS 'Semantic version string for project versioning';
COMMENT ON COLUMN projects.owner_id IS 'User who created and owns the project';

-- ============================================================================
-- ARTIFACTS TABLE
-- ============================================================================
-- Stores all project artifacts (requirements, diagrams, code, ADRs)
-- Requirements: 2.1, 2.2, 6.1, 6.2, 20.1

CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type artifact_type NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    CONSTRAINT artifacts_content_not_empty CHECK (content != '{}'::jsonb),
    CONSTRAINT artifacts_version_positive CHECK (version > 0)
);

-- Add comment for documentation
COMMENT ON TABLE artifacts IS 'Stores all project elements using stable key JSON schema';
COMMENT ON COLUMN artifacts.content IS 'Stable Key JSON Schema following RFC 6902 for surgical updates';
COMMENT ON COLUMN artifacts.metadata IS 'Additional metadata like tags, confidence scores, etc.';
COMMENT ON COLUMN artifacts.version IS 'Optimistic Concurrency Control version counter';

-- ============================================================================
-- CHANGE_LOG TABLE
-- ============================================================================
-- Audit trail for all artifact modifications
-- Requirements: 24.1, 24.2

CREATE TABLE change_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    patch JSONB NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by agent_type NOT NULL,
    agent_type VARCHAR(50),
    
    CONSTRAINT change_log_patch_not_empty CHECK (patch != '{}'::jsonb)
);

-- Add comment for documentation
COMMENT ON TABLE change_log IS 'Records all changes to artifacts using RFC 6902 JSON Patches';
COMMENT ON COLUMN change_log.patch IS 'RFC 6902 JSON Patch describing the change';
COMMENT ON COLUMN change_log.applied_by IS 'Whether change was made by user or AI agent';
COMMENT ON COLUMN change_log.agent_type IS 'Specific agent type if applied_by is an agent';

-- ============================================================================
-- TRACEABILITY_LINKS TABLE
-- ============================================================================
-- Maintains relationships between artifacts
-- Requirements: 14.1, 14.2, 14.4

CREATE TABLE traceability_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    link_type link_type NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    CONSTRAINT traceability_links_confidence_range CHECK (confidence >= 0.0 AND confidence <= 1.0),
    CONSTRAINT traceability_links_no_self_reference CHECK (source_id != target_id),
    CONSTRAINT traceability_links_unique UNIQUE (source_id, target_id, link_type)
);

-- Add comment for documentation
COMMENT ON TABLE traceability_links IS 'Bidirectional relationships between artifacts';
COMMENT ON COLUMN traceability_links.confidence IS 'AI confidence score from 0.0 to 1.0';
COMMENT ON COLUMN traceability_links.link_type IS 'Type of relationship: implements, derives_from, validates, references';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- Requirements: 27.1

-- Projects table indexes
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Artifacts table indexes
CREATE INDEX idx_artifacts_project_id ON artifacts(project_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_created_by ON artifacts(created_by);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX idx_artifacts_updated_at ON artifacts(updated_at DESC);
CREATE INDEX idx_artifacts_project_type ON artifacts(project_id, type);

-- GIN index for JSONB content searches
CREATE INDEX idx_artifacts_content_gin ON artifacts USING GIN (content);
CREATE INDEX idx_artifacts_metadata_gin ON artifacts USING GIN (metadata);

-- Change log indexes
CREATE INDEX idx_change_log_artifact_id ON change_log(artifact_id);
CREATE INDEX idx_change_log_applied_at ON change_log(applied_at DESC);
CREATE INDEX idx_change_log_applied_by ON change_log(applied_by);

-- Traceability links indexes
CREATE INDEX idx_traceability_links_source_id ON traceability_links(source_id);
CREATE INDEX idx_traceability_links_target_id ON traceability_links(target_id);
CREATE INDEX idx_traceability_links_link_type ON traceability_links(link_type);
CREATE INDEX idx_traceability_links_created_by ON traceability_links(created_by);

-- Composite indexes for common queries
CREATE INDEX idx_traceability_links_source_type ON traceability_links(source_id, link_type);
CREATE INDEX idx_traceability_links_target_type ON traceability_links(target_id, link_type);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to projects table
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to artifacts table
CREATE TRIGGER update_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
