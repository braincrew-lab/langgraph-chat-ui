"use client";

import { signOut, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Ban, LogOut, Mail } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function AccountSuspendedPage() {
  const { data: session } = useSession();

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
      <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 pb-2">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50"
        >
          <Ban className="h-8 w-8 text-red-600 dark:text-red-400" />
        </motion.div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">계정 정지됨</h1>
          <p className="text-sm text-muted-foreground">
            계정이 관리자에 의해 정지되었습니다
          </p>
        </div>
      </motion.div>

      {/* Message */}
      <motion.div
        variants={itemVariants}
        className="text-center text-muted-foreground text-sm leading-relaxed"
      >
        <p>
          계정이 정지되어 서비스를 이용할 수 없습니다. 문의사항이 있으시면
          관리자에게 연락해 주세요.
        </p>
        {session?.user?.email && (
          <p className="mt-4">
            계정:{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
          </p>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div variants={itemVariants} className="space-y-3">
        <Button
          onClick={() => (window.location.href = "mailto:support@example.com")}
          variant="outline"
          className="w-full h-11 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Mail className="mr-2 h-4 w-4" />
          문의하기
        </Button>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="w-full h-11 rounded-xl font-medium text-muted-foreground transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </motion.div>
    </motion.div>
  );
}
