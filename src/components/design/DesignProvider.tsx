import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyDesignTokens,
  cacheDesignTokens,
  readCachedDesignTokens,
  type DesignTokens,
} from "@/lib/design-studio";
import { applyTheme, type ThemeId } from "@/lib/themes";

/** Applies the globally saved design identity (colors, font, radius, shadow) on every page. */
export function DesignProvider() {
  useEffect(() => {
    const cached = readCachedDesignTokens();
    if (cached) applyDesignTokens(cached);

    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("brand_settings")
        .select("theme_id, primary_color, accent_color, background_color, font_family, radius, shadow")
        .maybeSingle();
      if (cancelled || !data) return;
      const tokens = data as DesignTokens;
      cacheDesignTokens(tokens);
      if (tokens.theme_id) applyTheme(tokens.theme_id as ThemeId);
      applyDesignTokens(tokens);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
