-- Daily Trace - 完整的 Supabase RPC 函数（修复版）
-- 请在 Supabase SQL Editor 中运行

-- ============================================
-- 第一步：删除旧函数
-- ============================================
DROP FUNCTION IF EXISTS execute_sql(text, jsonb);

-- ============================================
-- 第二步：创建改进的 execute_sql 函数
-- ============================================
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
  param_values TEXT[];
  i INTEGER;
  query_text TEXT;
BEGIN
  -- 记录查询（用于调试）
  RAISE NOTICE 'Executing SQL: %', sql_query;
  RAISE NOTICE 'Params: %', params;
  
  -- 将 JSONB 参数转换为文本数组
  IF params IS NOT NULL AND jsonb_array_length(params) > 0 THEN
    FOR i IN 0..jsonb_array_length(params) - 1 LOOP
      param_values := array_append(param_values, params->>i);
    END LOOP;
  END IF;
  
  -- 替换参数占位符
  query_text := sql_query;
  IF array_length(param_values, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(param_values, 1) LOOP
      query_text := replace(query_text, '$' || i, quote_literal(param_values[i]));
    END LOOP;
  END IF;
  
  -- 执行查询
  BEGIN
    -- 对于 SELECT 查询
    IF sql_query ILIKE 'SELECT%' THEN
      EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
      RETURN COALESCE(result, '[]'::jsonb);
    
    -- 对于 INSERT 查询
    ELSIF sql_query ILIKE 'INSERT%' THEN
      EXECUTE query_text;
      RETURN jsonb_build_object(
        'success', true,
        'changes', 1,
        'last_insert_rowid', COALESCE(currval(pg_get_serial_sequence('users', 'id')), 0)
      );
    
    -- 对于 UPDATE 查询
    ELSIF sql_query ILIKE 'UPDATE%' THEN
      EXECUTE query_text;
      RETURN jsonb_build_object(
        'success', true,
        'changes', 1
      );
    
    -- 对于 DELETE 查询
    ELSIF sql_query ILIKE 'DELETE%' THEN
      EXECUTE query_text;
      RETURN jsonb_build_object(
        'success', true,
        'changes', 1
      );
    
    -- 其他查询
    ELSE
      EXECUTE query_text;
      RETURN jsonb_build_object('success', true);
    END IF;
  
  EXCEPTION WHEN OTHERS THEN
    -- 记录错误
    RAISE WARNING 'SQL Error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$$;

-- ============================================
-- 第三步：测试函数
-- ============================================
-- 测试 SELECT 查询
SELECT execute_sql('SELECT 1 as test', '[]'::jsonb);

-- 测试 INSERT 查询（会失败，因为没有表，但可以看错误信息）
-- SELECT execute_sql('INSERT INTO test_table (name) VALUES ($1)', '["test"]'::jsonb);

-- ============================================
-- 说明
-- ============================================
-- 1. 这个函数会根据 SQL 语句类型执行不同的操作
-- 2. 对于 SELECT 查询，返回结果数组
-- 3. 对于 INSERT/UPDATE/DELETE，返回操作结果
-- 4. 所有错误都会被捕获并返回
-- 5. 使用了 quote_literal 来正确处理参数值
