"use client";

import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Provider = "google" | "microsoft";

type SocialLoginButtonProps = {
  provider: Provider;
  loading?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
    >
      <path
        fill="currentColor"
        d="M21.35 11.1H12.18v2.98h5.27c-.23 1.49-1.74 4.37-5.27 4.37-3.17 0-5.75-2.62-5.75-5.85s2.58-5.85 5.75-5.85c1.81 0 3.03.77 3.73 1.43l2.54-2.46C16.84 4.2 14.74 3.25 12.18 3.25c-5.1 0-9.23 4.17-9.23 9.35s4.13 9.35 9.23 9.35c5.33 0 8.86-3.74 8.86-9.01 0-.6-.06-1.05-.14-1.84Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
    >
      <path fill="#f25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00a4ef" d="M2 12.5h9.5V22H2z" />
      <path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

function getProviderCopy(provider: Provider) {
  if (provider === "google") {
    return {
      label: "Continue with Google",
      icon: <GoogleIcon />,
    };
  }

  return {
    label: "Continue with Microsoft",
    icon: <MicrosoftIcon />,
  };
}

export default function SocialLoginButton({
  provider,
  loading = false,
  type = "button",
  disabled,
  className,
  ...props
}: SocialLoginButtonProps) {
  const { label, icon } = getProviderCopy(provider);

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        "flex w-full items-center justify-center gap-3 rounded-[12px] border-[1.5px] border-[#534AB7] bg-transparent px-4 py-3 text-sm font-bold text-[#534AB7] transition-all duration-200",
        "hover:bg-[#EEEDFE]",
        "focus:outline-none focus:ring-[3px] focus:ring-[rgba(83,74,183,0.15)]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className ?? "",
      ].join(" ")}
      style={{ fontFamily: '"Trebuchet MS", sans-serif' }}
      {...props}
    >
      <span className="flex h-5 w-5 items-center justify-center">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <span>{label}</span>
    </button>
  );
}