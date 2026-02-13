"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import Link from "next/link";
import { useAuthContext } from "../AuthLayoutClient";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function VerifyRequestPage() {
  const { branding } = useAuthContext();
  const t = useTranslations("auth");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center gap-4 pb-2"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-muted/70 border-border flex h-16 w-16 items-center justify-center rounded-full border"
        >
          <Mail className="text-primary h-8 w-8" />
        </motion.div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("verify.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("verify.subtitle", { appName: branding.appName })}
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="text-muted-foreground text-center text-sm leading-relaxed"
      >
        <p className="whitespace-pre-line">{t("verify.clickLink")}</p>
        <p className="mt-4 whitespace-pre-line">{t("verify.checkSpam")}</p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Link href="/login">
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl font-medium"
          >
            {t("verify.backToLogin")}
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}
