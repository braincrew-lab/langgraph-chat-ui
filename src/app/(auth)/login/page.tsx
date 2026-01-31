"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoaderCircle, CheckCircle2, Mail, Lock, ArrowRight } from "lucide-react";
import { siteConfig } from "@/configs/site";
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
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  },
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const registered = searchParams.get("registered") === "true";
  const { allowRegistration } = useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Branding */}
      <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 pb-2">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteConfig.branding.logoPath}
            alt={`${siteConfig.branding.appName} 로고`}
            width={siteConfig.branding.logoWidth * 2}
            height={siteConfig.branding.logoHeight * 2}
            className="flex-shrink-0"
          />
        </motion.div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {siteConfig.branding.appName}
          </h1>
          <p className="text-sm text-muted-foreground">
            계정에 로그인하여 시작하세요
          </p>
        </div>
      </motion.div>

      {/* Registration success message */}
      {registered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 p-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 rounded-xl"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>회원가입이 완료되었습니다. 로그인해 주세요.</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Error message */}
        {error && (
          <motion.div
            ref={errorRef}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-xl"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
          >
            {error}
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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

        <motion.div variants={itemVariants} className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            비밀번호
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            size="lg"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Button
            type="submit"
            className="w-full h-11 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                <span>로그인 중…</span>
              </>
            ) : (
              <>
                <span>로그인</span>
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {allowRegistration && (
        <>
          <motion.div variants={itemVariants} className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 text-muted-foreground">또는</span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="text-center text-sm">
            <span className="text-muted-foreground">계정이 없으신가요? </span>
            <Link
              href="/register"
              className="font-medium text-primary hover:text-primary/80 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
            >
              회원가입
            </Link>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function LoginFormFallback() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 pb-2">
        <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
        <div className="text-center space-y-2">
          <div className="h-7 w-40 bg-muted rounded animate-pulse mx-auto" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse mx-auto" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-11 bg-muted rounded-xl animate-pulse" />
        <div className="h-11 bg-muted rounded-xl animate-pulse" />
        <div className="h-11 bg-muted rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
