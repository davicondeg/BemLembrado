function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

export function serverEnv() {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    webhookSecret: required("EVOLUTION_WEBHOOK_SECRET"),
    relaySecret: required("RELAY_SECRET"),
    jobsSecret: required("JOBS_SECRET"),
  };
}
