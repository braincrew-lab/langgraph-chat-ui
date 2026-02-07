"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, LogOut, RefreshCw } from "lucide-react";
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

export default function PendingApprovalPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  // Redirect if user is approved
  useEffect(() => {
    if (session?.user?.status === "active") {
      router.replace("/");
    }
  }, [session, router]);

  const handleRefresh = async () => {
    await update();
    if (session?.user?.status === "active") {
      router.replace("/");
    }
  };

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
          className="bg-muted/70 border-border flex h-16 w-16 items-center justify-center rounded-full border"
        >
          <Clock className="text-primary h-8 w-8" />
        </motion.div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">승인 대기 중</h1>
          <p className="text-muted-foreground text-sm">
            관리자의 승인을 기다리고 있습니다
          </p>
        </div>
      </motion.div>

      {/* Message */}
      <motion.div
        variants={itemVariants}
        className="text-muted-foreground text-center text-sm leading-relaxed"
      >
        <p>
          회원가입이 완료되었습니다. 관리자가 계정을 검토한 후 승인하면 서비스를
          이용하실 수 있습니다.
        </p>
        {session?.user?.email && (
          <p className="mt-4">
            등록 이메일:{" "}
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
          onClick={handleRefresh}
          variant="outline"
          className="h-11 w-full rounded-xl font-medium transition-colors"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          상태 확인
        </Button>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="text-muted-foreground h-11 w-full rounded-xl font-medium transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </Button>
      </motion.div>
    </motion.div>
  );
}
