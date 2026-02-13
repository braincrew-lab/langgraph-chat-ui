"use client";

import { signOut, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Ban, LogOut, Mail } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

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

export default function AccountSuspendedPage() {
  const { data: session } = useSession();
  const t = useTranslations("auth");
  const tc = useTranslations("common");

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Icon */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center gap-4 pb-2"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="border-destructive/35 bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full border"
        >
          <Ban className="text-destructive h-8 w-8" />
        </motion.div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("suspended.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("suspended.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Message */}
      <motion.div
        variants={itemVariants}
        className="text-muted-foreground text-center text-sm leading-relaxed"
      >
        <p>{t("suspended.description")}</p>
        {session?.user?.email && (
          <p className="mt-4">
            {t("suspended.account")}{" "}
            <span className="text-foreground font-medium">
              {session.user.email}
            </span>
          </p>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div
        variants={itemVariants}
        className="space-y-3"
      >
        <Button
          onClick={() => (window.location.href = "mailto:support@example.com")}
          variant="outline"
          className="h-11 w-full rounded-xl font-medium transition-colors"
        >
          <Mail className="mr-2 h-4 w-4" />
          {t("suspended.contact")}
        </Button>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="text-muted-foreground h-11 w-full rounded-xl font-medium transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {tc("logout")}
        </Button>
      </motion.div>
    </motion.div>
  );
}
