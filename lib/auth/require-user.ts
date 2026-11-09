import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACTIVE_EMAIL, getDemoSubscription } from "./demo-session";

export async function requireUser() {
  const demoSubscription = await getDemoSubscription();
  if (demoSubscription === "expired") redirect("/assinatura-vencida");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (demoSubscription === "active") return { user: { id: "demo-active", email: DEMO_ACTIVE_EMAIL }, supabase };
  if (!user) redirect("/login");
  if (user.user_metadata?.subscription_status === "pending") redirect("/assinatura-pendente");
  return { user, supabase };
}
