import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyDesignTokens,
  cacheDesignTokens,
  readCachedDesignTokens,
  type DesignTokens,
} from "@/lib/design-studio";
import { applyTheme, readStoredTheme, type ThemeId } from "@/lib/themes";

/**
 * Applies the saved design identity (font, radius, shadow, colors) globally.
 * A theme explicitly chosen by the user always wins over the brand colors,
 * so the theme switcher visibly changes background / buttons / text.
 */
export function DesignProvider() {
  useEffect(() => {
    const userTheme = readStoredTheme();
    if (userTheme) applyTheme(userTheme);

    const cached = readCachedDesignTokens();
    if (cached) applyDesignTokens(cached, { skipColors: !!userTheme });

    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("brand_settings")
        .select("theme_id, primary_color, accent_color, background_color, font_family, radius, shadow")
        .maybeSingle();
      if (cancelled || !data) return;
      const tokens = data as DesignTokens;
      cacheDesignTokens(tokens);

      if (userTheme) {
        // keep the user's choice; only typography/shape come from brand settings
        applyTheme(userTheme);
        applyDesignTokens(tokens, { skipColors: true });
        return;
      }

      if (tokens.theme_id) applyTheme(tokens.theme_id as ThemeId, { persist: false });
      applyDesignTokens(tokens);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
