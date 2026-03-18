import type { LucideIcon } from "lucide-react";

export type NavLink = {
  label: string;
  href: string;
};

export type Benefit = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type Testimonial = {
  role: string;
  school: string;
  quote: string;
};

export type FooterColumn = {
  title: string;
  links: Array<{ label: string; href: string }>;
};
