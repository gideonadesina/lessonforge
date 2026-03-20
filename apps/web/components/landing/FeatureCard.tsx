import { motion } from "framer-motion";
import type { Feature } from "@/components/landing/types";
import { cardHover } from "@/components/landing/motion";

type FeatureCardProps = {
  feature: Feature;
};

export function FeatureCard({ feature }: FeatureCardProps) {
  const Icon = feature.icon;

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: "easeOut" },
        },
      }}
      whileHover={cardHover}
      className="group rounded-3xl border border-purple-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-purple-900/10"
    >
      <div className="mb-5 inline-flex rounded-2xl bg-purple-100 p-3 text-purple-700 transition-colors group-hover:bg-purple-200">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {feature.description}
      </p>
    </motion.article>
  );
}