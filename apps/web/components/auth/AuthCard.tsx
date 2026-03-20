import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
};

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <section className="w-full max-w-md rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
      {children}
    </section>
  );
}