import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
};

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.4)] sm:p-8">
      {children}
    </section>
  );
}
