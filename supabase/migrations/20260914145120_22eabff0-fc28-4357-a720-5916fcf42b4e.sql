-- إعادة تعريف الدالة لتُرجع صفوفاً jsonb
CREATE OR REPLACE FUNCTION public.tvcc_exec_sql(sql text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY EXECUTE 'select to_jsonb(t) from (' || sql || ') t';
END;
$$;

GRANT EXECUTE ON FUNCTION public.tvcc_exec_sql(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.tvcc_exec_sql(text) FROM PUBLIC, anon, authenticated;

-- حذف الدالة العددية غير المستخدمة
DROP FUNCTION IF EXISTS public.tvcc_exec_sql_scalar(text);