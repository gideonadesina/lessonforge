import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
};

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <section className="w-full max-w-md rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_4px_24px_rgba(83,74,183,0.08)] sm:p-8">
      {children}
    </section>
  );
}