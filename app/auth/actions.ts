"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function credentials(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect("/login?erro=Informe um e-mail válido e uma senha com pelo menos 8 caracteres.");
  return { email, password };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) redirect(`/login?erro=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const data = credentials(formData);
  const fullName = String(formData.get("fullName") || "").trim();
  if (fullName.length < 2) redirect("/login?erro=Informe seu nome.");
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data: result, error } = await supabase.auth.signUp({ ...data, options: { data: { full_name: fullName }, emailRedirectTo: `${siteUrl}/auth/callback` } });
  if (error) redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  if (result.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  redirect("/login?sucesso=Cadastro criado. Confirme seu e-mail antes de entrar.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
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
