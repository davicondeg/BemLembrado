import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env/server";

export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
