export const APP_ROLES = ["teacher", "principal"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_STORAGE_KEY = "lessonforge:selected-role";

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

export function roleFromUserMetadata(
  userMetadata: unknown,
  fallback: AppRole | null = null
): AppRole | null {
  if (!userMetadata || typeof userMetadata !== "object") return fallback;
  const metadata = userMetadata as Record<string, unknown>;
  return normalizeRole(metadata.app_role) ?? fallback;
}