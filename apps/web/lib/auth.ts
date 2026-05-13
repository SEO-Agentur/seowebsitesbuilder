"use client";

export function saveSession(token: string, user: any) {
  localStorage.setItem("seo_token", token);
  localStorage.setItem("seo_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("seo_token");
  localStorage.removeItem("seo_user");
}

export function currentUser(): { id: string; email: string; name: string | null; is_admin?: boolean } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("seo_user");
  return raw ? JSON.parse(raw) : null;
}

export function isAuthed() {
  return typeof window !== "undefined" && !!localStorage.getItem("seo_token");
}
