import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWebsites from "./tools/list-websites";
import getWebsite from "./tools/get-website";
import createWebsite from "./tools/create-website";
import updateWebsite from "./tools/update-website";
import listSiteGroups from "./tools/list-site-groups";
import listExpiringDomains from "./tools/list-expiring-domains";
import getDashboardStats from "./tools/get-dashboard-stats";

// The OAuth issuer must be the direct Supabase host: the project ref is the only
// Supabase value that survives publish unchanged, and Vite inlines it at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tvcc-mcp",
  title: "TVCC — Website Control Center",
  version: "0.1.0",
  instructions:
    "Tools for the TVCC website control center. Use `list_websites` and `get_website` to inspect managed sites, " +
    "`create_website` / `update_website` to manage them, `list_site_groups` for grouping, " +
    "`list_expiring_domains` to catch domain renewals, and `get_dashboard_stats` for an overview. " +
    "All tools act as the signed-in user and only return data that user owns.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listWebsites,
    getWebsite,
    createWebsite,
    updateWebsite,
    listSiteGroups,
    listExpiringDomains,
    getDashboardStats,
  ],
});
