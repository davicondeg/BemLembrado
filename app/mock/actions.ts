"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isMockMode } from "@/lib/mock/data";

const allowedPaths = new Set(["/dashboard", "/pessoas", "/lembretes", "/historico", "/simulador"]);

export async function toggleMockMode(formData: FormData) {
  const store = await cookies();
  const enabled = await isMockMode();
  const returnTo = String(formData.get("returnTo") || "/dashboard");
  store.set("bem_lembrado_mock", enabled ? "0" : "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
  redirect(allowedPaths.has(returnTo) ? returnTo : "/dashboard");
}
