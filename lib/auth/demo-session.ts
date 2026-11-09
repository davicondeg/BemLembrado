import { cookies } from "next/headers";

export const DEMO_SESSION_COOKIE = "bem_lembrado_demo_session";
export const DEMO_ACTIVE_EMAIL = "ativo@bemlembrado.demo";
export const DEMO_EXPIRED_EMAIL = "vencido@bemlembrado.demo";
export const DEMO_PASSWORD = "Demo123!";

export type DemoSubscription = "active" | "expired";

export async function getDemoSubscription(): Promise<DemoSubscription | null> {
  const value = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  return value === "active" || value === "expired" ? value : null;
}
