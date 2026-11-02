"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function toggleMockMode() {
  const store = await cookies();
  const enabled = store.get("bem_lembrado_mock")?.value === "1";
  store.set("bem_lembrado_mock", enabled ? "0" : "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
}
