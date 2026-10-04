"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/session";

export async function loginAction(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await signIn(email, password);
  if (result.error) return result.error;
  redirect("/dashboard");
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}
