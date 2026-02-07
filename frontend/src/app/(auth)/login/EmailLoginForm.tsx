"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { LoaderCircle, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuthContext } from "../AuthLayoutClient";

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

export function EmailLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { branding } = useAuthContext();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("email", {
        email,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError("이메일 전송에 실패했습니다. 다시 시도해 주세요.");
      } else {
        setEmailSent(true);
      }
    } catch {
      setError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // Email sent success screen
  if (emailSent) {
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
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50"
          >
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </motion.div>
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              이메일을 확인하세요
            </h1>
            <p className="text-muted-foreground text-sm">
              로그인 링크를 보냈습니다
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="text-muted-foreground text-center text-sm leading-relaxed"
        >
          <p>
            <span className="text-foreground font-medium">{email}</span>
            <br />
            으로 로그인 링크를 보냈습니다.
          </p>
          <p className="mt-4">이메일의 링크를 클릭하여 로그인을 완료하세요.</p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl font-medium"
            onClick={() => {
              setEmailSent(false);
              setEmail("");
            }}
          >
            다른 이메일로 시도
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Branding */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center gap-4 pb-2"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.logoPath}
            alt={`${branding.appName} 로고`}
            width={branding.logoWidth * 2}
            height={branding.logoHeight * 2}
            className="flex-shrink-0"
          />
        </motion.div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {branding.appName}
          </h1>
          <p className="text-muted-foreground text-sm">
            이메일로 로그인 링크를 받으세요
          </p>
        </div>
      </motion.div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
        {/* Error message */}
        {error && (
          <motion.div
            ref={errorRef}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
          >
            {error}
          </motion.div>
        )}

        <motion.div
          variants={itemVariants}
          className="space-y-2"
        >
          <label
            htmlFor="email"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Mail
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            이메일
          </label>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            size="lg"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Button
            type="submit"
            className="h-11 w-full rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                <span>전송 중…</span>
              </>
            ) : (
              <>
                <span>로그인 링크 받기</span>
                <ArrowRight
                  className="ml-2 h-4 w-4"
                  aria-hidden="true"
                />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      <motion.div
        variants={itemVariants}
        className="text-center text-sm"
      >
        <p className="text-muted-foreground">
          입력하신 이메일로 로그인 링크가 전송됩니다.
          <br />
          비밀번호 없이 안전하게 로그인하세요.
        </p>
      </motion.div>
    </motion.div>
  );
}
