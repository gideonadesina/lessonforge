export type AuthRole = "teacher" | "principal";

type RoleConfig = {
  indicator: string;
  heading: string;
  subtext: string;
  postLoginPath: string;
};

export const AUTH_ROLE_CONFIG: Record<AuthRole, RoleConfig> = {
  teacher: {
    indicator: "FOR TEACHERS",
    heading: "Continue as Teacher",
    subtext:
      "Sign in to create lessons, worksheets, exams, and manage your planning.",
    postLoginPath: "/dashboard",
  },
  principal: {
    indicator: "FOR SCHOOL ADMIN",
    heading: "Continue as Principal",
    subtext:
      "Sign in to manage teachers, monitor activity, and oversee school planning.",
    postLoginPath: "/principal",
  },
};

const ROLE_ALIASES: Record<string, AuthRole> = {
  teacher: "teacher",
  principal: "principal",
  admin: "principal",
  "school-admin": "principal",
  schooladmin: "principal",
};

export function normalizeAuthRole(rawRole: string | null | undefined): AuthRole | null {
  if (!rawRole) return null;
  return ROLE_ALIASES[rawRole.toLowerCase()] ?? null;
}
