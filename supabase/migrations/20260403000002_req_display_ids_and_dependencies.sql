-- ============================================================================
-- 1. Project-scoped requirement counter for human-readable display IDs
--    e.g. ECO-1, ECO-2, AUTH-3
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN req_prefix  VARCHAR(10) DEFAULT NULL,
  ADD COLUMN req_counter INTEGER     NOT NULL DEFAULT 0;

COMMENT ON COLUMN projects.req_prefix  IS '3-4 letter prefix for display IDs, e.g. ECO. Derived from project name if not set.';
COMMENT ON COLUMN projects.req_counter IS 'Monotonically increasing counter for requirement display IDs within this project.';

-- Atomic function: increments counter and returns the new display ID
-- Usage: SELECT next_req_display_id('project-uuid')  →  'ECO-7'
CREATE OR REPLACE FUNCTION next_req_display_id(p_project_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix  TEXT;
  v_counter INTEGER;
BEGIN
  UPDATE projects
  SET req_counter = req_counter + 1
  WHERE id = p_project_id
  RETURNING req_prefix, req_counter INTO v_prefix, v_counter;

  -- Fall back to first 3 chars of project name if no prefix set
  IF v_prefix IS NULL OR v_prefix = '' THEN
    SELECT UPPER(SUBSTRING(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g'), 1, 4))
    INTO v_prefix
    FROM projects WHERE id = p_project_id;
  END IF;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    v_prefix := 'REQ';
  END IF;

  RETURN v_prefix || '-' || v_counter::TEXT;
END;
$$;

COMMENT ON FUNCTION next_req_display_id IS 'Atomically increments project req_counter and returns a display ID like ECO-7';

-- ============================================================================
-- 2. Requirement-to-requirement dependency table
-- ============================================================================

CREATE TYPE req_dependency_type AS ENUM ('blocks', 'parent_of', 'duplicates');

CREATE TABLE requirement_dependencies (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_requirement_id  UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  target_requirement_id  UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  dependency_type        req_dependency_type NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT req_dep_no_self_ref CHECK (source_requirement_id != target_requirement_id),
  CONSTRAINT req_dep_unique      UNIQUE (source_requirement_id, target_requirement_id, dependency_type)
);

CREATE INDEX idx_req_dep_source ON requirement_dependencies(source_requirement_id);
CREATE INDEX idx_req_dep_target ON requirement_dependencies(target_requirement_id);

COMMENT ON TABLE requirement_dependencies IS 'Typed DAG edges between requirements (blocks, parent_of, duplicates)';

-- ============================================================================
-- 3. RLS for requirement_dependencies
-- ============================================================================

ALTER TABLE requirement_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deps in their projects"
  ON requirement_dependencies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM artifacts a
      JOIN projects p ON p.id = a.project_id
      WHERE a.id = requirement_dependencies.source_requirement_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create deps in their projects"
  ON requirement_dependencies FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM artifacts a
      JOIN projects p ON p.id = a.project_id
      WHERE a.id = requirement_dependencies.source_requirement_id
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete deps in their projects"
  ON requirement_dependencies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM artifacts a
      JOIN projects p ON p.id = a.project_id
      WHERE a.id = requirement_dependencies.source_requirement_id
        AND p.owner_id = auth.uid()
    )
  );
