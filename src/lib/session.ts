import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_USERS } from "@/lib/auth";
import type { AppRole, Profile } from "@/types/domain";

const COOKIE = "arms_session";

export async function getSession(): Promise<Profile | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function signIn(email: string, password: string) {
  const user = DEMO_USERS.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password,
  );
  if (!user) return { error: "Invalid email or password." };

  const profile: Profile = {
    id: user.role,
    fullName: user.fullName,
    role: user.role as AppRole,
    email: user.email,
  };

  (await cookies()).set(COOKIE, JSON.stringify(profile), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return { error: null };
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
