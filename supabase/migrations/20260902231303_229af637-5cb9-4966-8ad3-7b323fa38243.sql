CREATE OR REPLACE FUNCTION public.manara_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.manara_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manara_touch_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.manara_touch_updated_at() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.manara_log_address_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manara_log_address_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.manara_log_address_change() FROM authenticated;