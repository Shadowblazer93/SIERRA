/**
 * SIERRA Global Configuration
 * 
 * Toggle features on/off here before building or running.
 */
export const APP_CONFIG = {
  /**
   * When true, users must authenticate via Supabase before using SIERRA.
   * Paste supabase credentials in .env:
   * REACT_APP_SUPABASE_URL=
   * REACT_APP_SUPABASE_PUBLISHABLE_KEY=
   * 
   * When false, the auth page is skipped and SIERRA opens directly.
   * Default: false (recommended for local hosting).
   */
  AUTH_ENABLED: false,
};
