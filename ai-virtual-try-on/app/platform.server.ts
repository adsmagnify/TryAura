/**
 * Dev/platform env helpers for the embedded app server.
 */
export function getDevAdminEmails(): string[] {
  return (process.env.DEV_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isDevAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getDevAdminEmails().includes(email.toLowerCase());
}

export function getPlatformAdminSecret(): string {
  return process.env.PLATFORM_ADMIN_SECRET || "";
}

export function getBackendUrl(): string {
  return (
    process.env.TRYON_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.PUBLIC_BACKEND_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/$/, "");
}

export async function fetchPlatformBackend(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const secret = getPlatformAdminSecret();
  if (secret) {
    headers.set("x-platform-admin-key", secret);
  }
  headers.set("Content-Type", "application/json");

  return fetch(`${getBackendUrl()}${path}`, { ...init, headers });
}
