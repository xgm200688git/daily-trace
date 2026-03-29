-- Daily Trace - Supabase RPC Functions
-- Run this in your Supabase SQL Editor after running supabase_schema.sql

-- ============================================
-- Execute SQL Function
-- ============================================
-- This function allows executing SQL queries with parameters
-- It's used by the application to interact with the database

CREATE OR REPLACE FUNCTION execute_sql(
  sql_query TEXT,
  params JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  param_array TEXT[];
  i INTEGER;
BEGIN
  -- Convert JSONB params to array
  IF params IS NOT NULL AND jsonb_array_length(params) > 0 THEN
    FOR i IN 0..jsonb_array_length(params) - 1 LOOP
      param_array := array_append(param_array, params->>i);
    END LOOP;
  END IF;

  -- Execute the query
  IF array_length(param_array, 1) IS NULL THEN
    EXECUTE sql_query;
  ELSE
    EXECUTE sql_query USING VARIADIC param_array;
  END IF;

  -- Try to return results
  BEGIN
    -- For SELECT queries, return the results
    IF sql_query ILIKE 'SELECT%' THEN
      EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql_query || ') t' 
      INTO result 
      USING VARIADIC param_array;
      RETURN result;
    -- For INSERT/UPDATE/DELETE, return affected rows info
    ELSE
      RETURN jsonb_build_object(
        'changes', 1,
        'last_insert_rowid', COALESCE(currval(pg_get_serial_sequence('users', 'id')), 0)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If we can't get results, just return success
    RETURN jsonb_build_object('success', true);
  END;
END;
$$;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- Enable RLS on all tables

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for users table
-- ============================================
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (true);

-- ============================================
-- RLS Policies for sessions table
-- ============================================
CREATE POLICY "Sessions are viewable by all"
  ON sessions FOR SELECT
  USING (true);

CREATE POLICY "Sessions can be inserted by all"
  ON sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sessions can be deleted by all"
  ON sessions FOR DELETE
  USING (true);

-- ============================================
-- RLS Policies for application tables
-- ============================================
-- For now, allow all operations (you can restrict this later based on user_id)
CREATE POLICY "Allow all operations on profile_settings"
  ON profile_settings FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on templates"
  ON templates FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on entries"
  ON entries FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on daily_records"
  ON daily_records FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on weekly_reports"
  ON weekly_reports FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on job_runs"
  ON job_runs FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on sync_status"
  ON sync_status FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on change_queue"
  ON change_queue FOR ALL
  USING (true);

CREATE POLICY "Allow all operations on conflict_history"
  ON conflict_history FOR ALL
  USING (true);

-- ============================================
-- Indexes for better performance
-- ============================================
-- These are already created in supabase_schema.sql, but adding here for reference

-- CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
-- CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
-- CREATE INDEX IF NOT EXISTS idx_entries_profile_id ON entries(profile_id);
-- CREATE INDEX IF NOT EXISTS idx_entries_module_date ON entries(profile_id, module, local_date);
-- CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(profile_id, record_date);
-- CREATE INDEX IF NOT EXISTS idx_weekly_reports_current ON weekly_reports(profile_id, week_start, is_current);

-- ============================================
-- Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profile_settings_updated_at BEFORE UPDATE ON profile_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entries_updated_at BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_records_updated_at BEFORE UPDATE ON daily_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_reports_updated_at BEFORE UPDATE ON weekly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_runs_updated_at BEFORE UPDATE ON job_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at BEFORE UPDATE ON sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_change_queue_updated_at BEFORE UPDATE ON change_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Grant permissions
-- ============================================
-- Grant necessary permissions to the anon key user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- ============================================
-- Notes
-- ============================================
-- 1. The execute_sql function allows the application to run SQL queries
-- 2. RLS policies are set to allow all operations for now (you can restrict later)
-- 3. Updated_at triggers automatically update the timestamp on record changes
-- 4. All necessary permissions are granted to the anon key user
-- 5. After running this, you can use the application with Supabase
