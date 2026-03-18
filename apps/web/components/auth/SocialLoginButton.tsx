type SocialProvider = "google" | "microsoft";

type SocialLoginButtonProps = {
  provider: SocialProvider;
  loading?: boolean;
  onClick: () => void;
};

function ProviderIcon({ provider }: { provider: SocialProvider }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.225 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.046 6.053 29.282 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 16.108 19.011 13 24 13c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C34.046 6.053 29.282 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.18 0 9.86-1.977 13.41-5.192l-6.19-5.238C29.148 35.091 26.715 36 24 36c-5.204 0-9.621-3.316-11.283-7.946l-6.522 5.024C9.504 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.05 12.05 0 0 1-4.083 5.57h.003l6.19 5.238C36.973 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M13 1h10v10H13z" />
      <path fill="#05a6f0" d="M1 13h10v10H1z" />
      <path fill="#ffba08" d="M13 13h10v10H13z" />
    </svg>
  );
}

export default function SocialLoginButton({
  provider,
  loading = false,
  onClick,
}: SocialLoginButtonProps) {
  const providerName = provider === "google" ? "Google" : "Microsoft";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <ProviderIcon provider={provider} />
      <span>{loading ? "Please wait..." : `Continue with ${providerName}`}</span>
    </button>
  );
}
