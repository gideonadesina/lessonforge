import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_PAGES = ["/login", "/forgot-password"];
const PUBLIC_EXACT_PATHS = new Set<string>(["/", "/select-role"]);
const TEACHER_PROTECTED_PREFIXES = [
  "/dashboard",
  "/generate",
  "/library",
  "/planning",
  "/settings",
  "/worksheets",
  "/exam-builder",
  "/exam-prep",
  "/lesson",
  "/school",
  "/account",
];

function isAuthFlowPath(pathname: string) {
  return pathname.startsWith("/auth/");
}

function isAuthCallbackPath(pathname: string, request: NextRequest) {
  if (!isAuthFlowPath(pathname)) return false;
  const search = request.nextUrl.searchParams;
  return (
    search.has("code") ||
    search.has("access_token") ||
    search.has("refresh_token") ||
    search.has("provider_token")
  );
}

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (AUTH_PAGES.includes(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/")) return true;
  return false;
}

function isProtectedPath(pathname: string) {
  if (pathname.startsWith("/principal")) return true;
  return TEACHER_PROTECTED_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser(); // refresh session cookies
  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (isProtectedPath(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  if ((AUTH_PAGES.includes(pathname) || isAuthFlowPath(pathname)) && !isAuthCallbackPath(pathname, request)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/select-role";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!isPublicPath(pathname) && !isProtectedPath(pathname) && pathname !== "/") {
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
