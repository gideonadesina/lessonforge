export const APP_ROLES = ["teacher", "principal"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_STORAGE_KEY = "lessonforge:selected-role";
export const ROLE_COOKIE_KEY = "lessonforge-active-role";

type RoleContent = {
  label: string;
  selectionTitle: string;
  selectionDescription: string;
  authTitle: string;
  authSubtitle: string;
  postAuthPath: string;
};

export const ROLE_CONTENT: Record<AppRole, RoleContent> = {
  teacher: {
    label: "Teacher",
    selectionTitle: "Teacher",
    selectionDescription:
      "Create lesson plans, worksheets, exams, and manage class planning.",
    authTitle: "Continue as a Teacher",
    authSubtitle:
      "Sign in to create lessons, worksheets, exams, slides, and manage your planning.",
    postAuthPath: "/dashboard",
  },
  principal: {
    label: "Principal",
    selectionTitle: "Principal / School Admin",
    selectionDescription:
      "Oversee teachers, school planning, curriculum visibility, and academic operations.",
    authTitle: "Continue as a Principal",
    authSubtitle:
      "Sign in to oversee academic planning, teacher activity, school setup, and curriculum operations.",
     postAuthPath: "/principal/dashboard",
  },
};

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value === "teacher" || value === "principal";
}

export function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  return isAppRole(value) ? value : null;
}

export function getRoleHomePath(role: AppRole) {
  return ROLE_CONTENT[role].postAuthPath;
}

export function resolvePreferredRole(
  availableRoles: AppRole[],
  preferredRole: AppRole | null | undefined,
  options?: { allowNullWhenMultiple?: boolean }
): AppRole | null {
  const uniqueRoles = Array.from(new Set(availableRoles));
  const allowNullWhenMultiple = Boolean(options?.allowNullWhenMultiple);

  if (preferredRole && uniqueRoles.includes(preferredRole)) {
    return preferredRole;
  }

  if (uniqueRoles.length === 1) {
    return uniqueRoles[0] ?? null;
  }

  if (uniqueRoles.length === 0) {
    return null;
  }

  if (allowNullWhenMultiple) {
    return null;
  }

  return uniqueRoles[0] ?? null;
}

export function readStoredRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  const role = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return normalizeRole(role);
}

export function persistActiveRole(role: AppRole) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  window.document.cookie = `${ROLE_COOKIE_KEY}=${role}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function clearPersistedActiveRole() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
  window.document.cookie = `${ROLE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function roleFromUserMetadata(
  userMetadata: unknown,
  fallback: AppRole | null = null
): AppRole | null {
  if (!userMetadata || typeof userMetadata !== "object") return fallback;
  const metadata = userMetadata as Record<string, unknown>;
  return normalizeRole(metadata.app_role) ?? fallback;
}