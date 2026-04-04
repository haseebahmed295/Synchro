-- Add target_node_id to traceability_links
-- Stores the React Flow string node ID (e.g. 'AUTH_SERVICE') inside a diagram artifact
-- This enables requirement → specific node linkage without embedding data in diagram JSON

ALTER TABLE traceability_links ADD COLUMN target_node_id text;

COMMENT ON COLUMN traceability_links.target_node_id IS 'React Flow node string ID within the target diagram artifact. NULL means artifact-level link.';

-- Index for fast node-level lookups (Phase 3: node click sidebar)
CREATE INDEX idx_traceability_links_target_node_id ON traceability_links(target_node_id);
