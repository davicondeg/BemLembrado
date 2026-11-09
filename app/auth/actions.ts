"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACTIVE_EMAIL, DEMO_EXPIRED_EMAIL, DEMO_PASSWORD, DEMO_SESSION_COOKIE } from "@/lib/auth/demo-session";

function credentials(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect("/login?erro=Informe um e-mail válido e uma senha com pelo menos 8 caracteres.");
  return { email, password };
}

export async function signIn(formData: FormData) {
  const data = credentials(formData);
  const email = data.email.toLowerCase();
  if ((email === DEMO_ACTIVE_EMAIL || email === DEMO_EXPIRED_EMAIL) && data.password === DEMO_PASSWORD) {
    const cookieStore = await cookies();
    const subscription = email === DEMO_ACTIVE_EMAIL ? "active" : "expired";
    cookieStore.set(DEMO_SESSION_COOKIE, subscription, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 4 });
    cookieStore.set("bem_lembrado_mock", subscription === "active" ? "1" : "0", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 4 });
    revalidatePath("/", "layout");
    redirect(subscription === "active" ? "/dashboard" : "/assinatura-vencida");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  cookieStore.delete("bem_lembrado_mock");
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const data = credentials(formData);
  const fullName = String(formData.get("fullName") || "").trim();
  const plan = String(formData.get("plan") || "");
  const acceptedTerms = formData.get("terms") === "on";
  if (fullName.length < 2) redirect("/criar-conta?erro=Informe seu nome.");
  if (!["individual", "family", "complete"].includes(plan)) redirect("/criar-conta?erro=Escolha um plano para continuar.");
  if (!acceptedTerms) redirect("/criar-conta?erro=Aceite os termos e a política de privacidade para continuar.");
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data: result, error } = await supabase.auth.signUp({ ...data, options: { data: { full_name: fullName, selected_plan: plan, subscription_status: "pending" }, emailRedirectTo: `${siteUrl}/auth/callback?next=/assinatura-pendente` } });
  if (error) redirect(`/criar-conta?erro=${encodeURIComponent(error.message)}`);
  if (result.session) {
    revalidatePath("/", "layout");
    redirect("/assinatura-pendente");
  }
  redirect("/login?sucesso=Cadastro criado. Confirme seu e-mail para continuar com a assinatura.");
}

export async function simulateSubscriptionPayment() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ data: { ...user.user_metadata, subscription_status: "active", subscription_started_at: new Date().toISOString() } });
  if (error) redirect(`/assinatura-pendente?erro=${encodeURIComponent("Não foi possível ativar a assinatura.")}`);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
  cookieStore.delete("bem_lembrado_mock");
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function renewDemoSubscription() {
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_SESSION_COOKIE)?.value !== "expired") redirect("/login");
  cookieStore.set(DEMO_SESSION_COOKIE, "active", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 4 });
  cookieStore.set("bem_lembrado_mock", "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 4 });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) redirect("/esqueci-senha?erro=Informe seu e-mail.");
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/callback?next=/redefinir-senha` });
  redirect("/esqueci-senha?sucesso=Se a conta existir, você receberá um link para redefinir a senha.");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");
  if (password.length < 8) redirect("/redefinir-senha?erro=A nova senha deve ter pelo menos 8 caracteres.");
  if (password !== confirmation) redirect("/redefinir-senha?erro=As senhas não são iguais.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha?erro=O link expirou. Solicite uma nova redefinição.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/redefinir-senha?erro=${encodeURIComponent(error.message)}`);
  await supabase.auth.signOut();
  redirect("/login?sucesso=Senha alterada. Entre novamente com a nova senha.");
}
