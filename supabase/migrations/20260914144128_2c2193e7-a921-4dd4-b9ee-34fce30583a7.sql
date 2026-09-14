-- إلغاء صلاحية anon و authenticated على دوال التنفيذ الداخلي
REVOKE EXECUTE ON FUNCTION public.tvcc_exec_sql(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tvcc_exec_sql_scalar(text) FROM anon, authenticated;

-- التأكد من بقاء الصلاحية لـ service_role
GRANT EXECUTE ON FUNCTION public.tvcc_exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tvcc_exec_sql_scalar(text) TO service_role;