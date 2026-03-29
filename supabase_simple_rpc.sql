-- Daily Trace - 简化版 Supabase RPC 函数
-- 请在 Supabase SQL Editor 中逐个运行以下命令

-- ============================================
-- 第一步：删除旧的函数（如果存在）
-- ============================================
DROP FUNCTION IF EXISTS execute_sql(text, jsonb);

-- ============================================
-- 第二步：创建简化的 execute_sql 函数
-- ============================================
CREATE OR REPLACE FUNCTION execute_sql(
  sql_query TEXT,
  params JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 简化版本：直接执行 SQL 并返回成功
  -- 注意：这个版本主要用于 INSERT/UPDATE/DELETE 操作
  -- 对于 SELECT 查询，我们会在应用层处理
  
  -- 执行 SQL
  EXECUTE sql_query;
  
  -- 返回成功信息
  RETURN jsonb_build_object(
    'success', true,
    'changes', 1,
    'last_insert_rowid', 0
  );
  
EXCEPTION WHEN OTHERS THEN
  -- 如果出错，返回错误信息
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ============================================
-- 第三步：测试函数是否正常工作
-- ============================================
-- 运行这个测试查询，应该返回 {"success": true, "changes": 1, "last_insert_rowid": 0}
SELECT execute_sql('SELECT 1', '[]'::jsonb);

-- ============================================
-- 说明
-- ============================================
-- 1. 这个简化版本的函数会执行所有 SQL 语句
-- 2. 对于 INSERT/UPDATE/DELETE 操作，它会返回成功信息
-- 3. 对于 SELECT 查询，我们的应用代码会直接使用 Supabase 客户端
-- 4. 如果遇到错误，函数会返回错误信息
