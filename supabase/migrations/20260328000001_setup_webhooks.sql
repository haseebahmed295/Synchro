/**
 * Supabase Webhook Configuration
 * Sets up database triggers for INSERT, UPDATE, DELETE on artifacts table
 * Requirements: 18.1
 */

-- Create a function to notify on artifact changes
CREATE OR REPLACE FUNCTION notify_artifact_change()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger will be used by Supabase webhooks
  -- The webhook configuration is done through Supabase Dashboard or CLI
  -- This function serves as a placeholder for future webhook logic
  
  -- Log the change type
  RAISE NOTICE 'Artifact change detected: % on artifact %', TG_OP, COALESCE(NEW.id, OLD.id);
  
  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for INSERT, UPDATE, DELETE on artifacts table
DROP TRIGGER IF EXISTS artifact_insert_trigger ON artifacts;
CREATE TRIGGER artifact_insert_trigger
  AFTER INSERT ON artifacts
  FOR EACH ROW
  EXECUTE FUNCTION notify_artifact_change();

DROP TRIGGER IF EXISTS artifact_update_trigger ON artifacts;
CREATE TRIGGER artifact_update_trigger
  AFTER UPDATE ON artifacts
  FOR EACH ROW
  EXECUTE FUNCTION notify_artifact_change();

DROP TRIGGER IF EXISTS artifact_delete_trigger ON artifacts;
CREATE TRIGGER artifact_delete_trigger
  AFTER DELETE ON artifacts
  FOR EACH ROW
  EXECUTE FUNCTION notify_artifact_change();

-- Add comment explaining webhook setup
COMMENT ON FUNCTION notify_artifact_change() IS 
'Trigger function for artifact changes. Webhooks must be configured in Supabase Dashboard:
1. Go to Database > Webhooks
2. Create new webhook with URL: https://your-domain.vercel.app/api/webhooks/supabase
3. Select table: artifacts
4. Select events: INSERT, UPDATE, DELETE
5. Add webhook secret to environment variables';
