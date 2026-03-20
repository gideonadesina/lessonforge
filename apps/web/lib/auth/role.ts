export type AppRole = "teacher" | "principal";

function normalizeRole(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function roleFromUserMetadata(
  user:
    | {
        user_metadata?: Record<string, unknown> | null;
        app_metadata?: Record<string, unknown> | null;
      }
    | null
    | undefined
): AppRole {
  const role =
    normalizeRole(user?.user_metadata?.app_role) ||
    normalizeRole(user?.app_metadata?.app_role) ||
    normalizeRole(user?.user_metadata?.role) ||
    normalizeRole(user?.app_metadata?.role);

  return role === "principal" ? "principal" : "teacher";
}

export function routeForRole(role: AppRole): "/dashboard" | "/principal" {
  return role === "principal" ? "/principal" : "/dashboard";
}

export function routeForUser(
  user:
    | {
        user_metadata?: Record<string, unknown> | null;
        app_metadata?: Record<string, unknown> | null;
      }
    | null
    | undefined
): "/dashboard" | "/principal" {
  return routeForRole(roleFromUserMetadata(user));
}
