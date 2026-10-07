import { createClient } from "@supabase/supabase-js";

export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY),
);

const publicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "placeholder";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co",
  publicKey,
  { auth: { persistSession: true, autoRefreshToken: true } },
);

export const projectionSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co",
  publicKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "linha-viva-projection",
      storage: window.sessionStorage,
    },
  },
);
