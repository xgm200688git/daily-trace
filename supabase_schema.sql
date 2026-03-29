-- Daily Trace - Supabase Database Schema
-- Run this in your Supabase SQL Editor to create all necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users and Sessions Tables (for authentication)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- Main Application Tables
-- ============================================

CREATE TABLE IF NOT EXISTS profile_settings (
  id INTEGER PRIMARY KEY,
  timezone TEXT NOT NULL,
  week_starts_on INTEGER NOT NULL,
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  default_template_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profile_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  definition_json TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profile_settings(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  local_date TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT,
  tags_json TEXT,
  task_status TEXT,
  completed_at TIMESTAMPTZ,
  completed_local_date TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_records (
  id TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profile_settings(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  record_date TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  content_json TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  generator_mode TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, module, record_date)
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profile_settings(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  revision INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  content_markdown TEXT NOT NULL,
  sections_json TEXT NOT NULL,
  source_record_ids_json TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  generator_mode TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, week_start, revision)
);

CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profile_settings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  job_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_status (
  id SERIAL PRIMARY KEY,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_queue (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  change_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source_hash TEXT NOT NULL DEFAULT '',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conflict_history (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  local_updated_at TIMESTAMPTZ,
  cloud_updated_at TIMESTAMPTZ,
  local_source_hash TEXT,
  cloud_source_hash TEXT,
  resolved_strategy TEXT NOT NULL,
  winner_source TEXT NOT NULL,
  local_data TEXT,
  cloud_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_entries_module_date ON entries(profile_id, module, local_date);
CREATE INDEX IF NOT EXISTS idx_entries_completed_date ON entries(profile_id, module, completed_local_date);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(profile_id, record_date);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_current ON weekly_reports(profile_id, week_start, is_current);
CREATE INDEX IF NOT EXISTS idx_templates_default ON templates(profile_id, is_default);
CREATE INDEX IF NOT EXISTS idx_job_runs_type ON job_runs(profile_id, type, updated_at);
CREATE INDEX IF NOT EXISTS idx_profile_settings_updated_at ON profile_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON templates(updated_at);
CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);
CREATE INDEX IF NOT EXISTS idx_daily_records_updated_at ON daily_records(updated_at);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_updated_at ON weekly_reports(updated_at);
CREATE INDEX IF NOT EXISTS idx_job_runs_updated_at ON job_runs(updated_at);
CREATE INDEX IF NOT EXISTS idx_sync_status_updated_at ON sync_status(updated_at);
CREATE INDEX IF NOT EXISTS idx_change_queue_status ON change_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_conflict_history_table_record ON conflict_history(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_conflict_history_created_at ON conflict_history(created_at);

-- ============================================
-- SQL Execution Function (for SupabaseAdapter)
-- ============================================

CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT, params JSONB DEFAULT '[]'::jsonb)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  param_values TEXT[];
  i INTEGER;
  sql_with_params TEXT;
BEGIN
  -- Convert jsonb array to postgres array
  SELECT ARRAY(SELECT jsonb_array_elements_text(params)) INTO param_values;
  
  -- Replace $1, $2, etc. with actual values
  sql_with_params := sql_query;
  FOR i IN 1..array_length(param_values, 1) LOOP
    sql_with_params := replace(sql_with_params, '$' || i, quote_nullable(param_values[i]));
  END LOOP;
  
  -- Execute the query and return results as JSON
  RETURN QUERY EXECUTE 'SELECT to_jsonb(t) FROM (' || sql_with_params || ') t';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing query: %', SQLERRM;
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

-- Note: For proper security, you should set up RLS policies based on your auth setup.
-- For now, we'll allow full access for the service role.
