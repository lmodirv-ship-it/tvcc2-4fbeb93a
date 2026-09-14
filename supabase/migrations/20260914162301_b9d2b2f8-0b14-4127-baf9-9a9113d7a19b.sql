CREATE OR REPLACE FUNCTION public.tvcc_exec_sql(sql text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stmt text;
  affected bigint;
BEGIN
  stmt := btrim(sql);
  -- remove trailing semicolons/whitespace
  stmt := regexp_replace(stmt, '[\s;]+$', '');
  IF stmt = '' THEN
    RETURN;
  END IF;

  IF stmt ~* '^\s*(select|with|table|values|show|explain)\b'
     OR stmt ~* '\breturning\b' THEN
    RETURN QUERY EXECUTE 'select to_jsonb(t) from (' || stmt || ') t';
  ELSE
    EXECUTE stmt;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN QUERY SELECT jsonb_build_object('status', 'ok', 'rows_affected', affected);
  END IF;
END;
$function$;