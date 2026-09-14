-- إلغاء الصلاحية الافتراضية لـ PUBLIC بالكامل
REVOKE EXECUTE ON FUNCTION public.tvcc_exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tvcc_exec_sql_scalar(text) FROM PUBLIC;

-- الاحتفاظ بالصلاحية لـ service_role فقط
GRANT EXECUTE ON FUNCTION public.tvcc_exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tvcc_exec_sql_scalar(text) TO service_role;