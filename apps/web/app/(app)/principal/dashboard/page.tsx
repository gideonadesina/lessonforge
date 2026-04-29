import { redirect } from "next/navigation";

export default async function PrincipalDashboardAliasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const success = params?.success;
  const hasSuccess = Array.isArray(success)
    ? success.includes("true")
    : success === "true";

  redirect(hasSuccess ? "/principal?success=true" : "/principal");
}
