"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  LoaderCircle,
  User,
  Mail,
  Lock,
  KeyRound,
  ArrowRight,
  Ban,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useAuthContext } from "../AuthLayoutClient";
import { registerUser } from "@/app/actions/auth";
import type { UserStatus } from "@/types/auth-mode";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
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

export default function RegisterPage() {
  const router = useRouter();
  const { allowRegistration, branding } = useAuthContext();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registrationStatus, setRegistrationStatus] =
    useState<UserStatus | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const errorRef = useRef<HTMLDivElement>(null);

  // Focus error message when error occurs
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (password.length < 8) {
      errors.password = "비밀번호는 8자 이상이어야 합니다.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!validateForm()) {
      return;
    }

    startTransition(async () => {
      const result = await registerUser({ name, email, password });

      if (!result.success) {
        if (result.error.includes("already exists")) {
          setError("이미 등록된 이메일입니다.");
        } else {
          setError(result.error || "회원가입에 실패했습니다.");
        }
        return;
      }

      // Store registration result
      setRegistrationStatus(result.data.status);
      setRegisteredEmail(email);
      setRegistrationComplete(true);
    });
  };

  // If registration is disabled, show a message
  if (!allowRegistration) {
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
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-muted/50 border-border flex flex-col items-center gap-4 rounded-xl border p-6"
        >
          <Ban className="text-muted-foreground h-12 w-12" />
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-semibold">
              회원가입이 비활성화되어 있습니다
            </h2>
            <p className="text-muted-foreground text-sm">
              현재 새로운 회원가입을 받지 않고 있습니다.
              <br />
              관리자에게 문의해 주세요.
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="text-center text-sm"
        >
          <span className="text-muted-foreground">
            이미 계정이 있으신가요?{" "}
          </span>
          <Link
            href="/login"
            className="text-primary hover:text-primary/80 focus-visible:ring-primary rounded-sm font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            로그인
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  // Show registration complete screen
  if (registrationComplete) {
    const isPendingApproval = registrationStatus === "pending";

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
            className={`flex h-16 w-16 items-center justify-center rounded-full ${
              isPendingApproval
                ? "bg-amber-100 dark:bg-amber-900/50"
                : "bg-green-100 dark:bg-green-900/50"
            }`}
          >
            {isPendingApproval ? (
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            ) : (
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            )}
          </motion.div>
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {isPendingApproval ? "가입 신청 완료" : "회원가입 완료"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isPendingApproval
                ? "관리자 승인 후 이용하실 수 있습니다"
                : "지금 바로 로그인할 수 있습니다"}
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="text-muted-foreground text-center text-sm leading-relaxed"
        >
          {isPendingApproval ? (
            <p>
              회원가입 신청이 완료되었습니다.
              <br />
              관리자가 계정을 검토한 후 승인하면
              <br />
              서비스를 이용하실 수 있습니다.
            </p>
          ) : (
            <p>
              회원가입이 완료되었습니다.
              <br />
              아래 버튼을 클릭하여 로그인해 주세요.
            </p>
          )}
          <p className="mt-4">
            등록 이메일:{" "}
            <span className="text-foreground font-medium">
              {registeredEmail}
            </span>
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          {isPendingApproval ? (
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => router.push("/login")}
            >
              로그인 페이지로 이동
            </Button>
          ) : (
            <Button
              className="h-11 w-full rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => router.push("/login")}
            >
              로그인하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
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
            새 계정을 만들어 시작하세요
          </p>
        </div>
      </motion.div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
        {/* General error message */}
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
            htmlFor="name"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <User
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            이름{" "}
            <span className="text-muted-foreground font-normal">(선택)</span>
          </label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            size="lg"
          />
        </motion.div>

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
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
            spellCheck={false}
            size="lg"
          />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="space-y-2"
        >
          <label
            htmlFor="password"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Lock
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            비밀번호
          </label>
          <Input
            id="password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="8자 이상 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isPending}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            size="lg"
          />
          {fieldErrors.password && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              id="password-error"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {fieldErrors.password}
            </motion.p>
          )}
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="space-y-2"
        >
          <label
            htmlFor="confirmPassword"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <KeyRound
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            비밀번호 확인
          </label>
          <Input
            id="confirmPassword"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호 재입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isPending}
            aria-invalid={!!fieldErrors.confirmPassword}
            aria-describedby={
              fieldErrors.confirmPassword ? "confirm-password-error" : undefined
            }
            size="lg"
          />
          {fieldErrors.confirmPassword && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              id="confirm-password-error"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {fieldErrors.confirmPassword}
            </motion.p>
          )}
        </motion.div>

        <motion.div variants={itemVariants}>
          <Button
            type="submit"
            className="h-11 w-full rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <LoaderCircle
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                <span>가입 중…</span>
              </>
            ) : (
              <>
                <span>회원가입</span>
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
        className="relative"
      >
        <div className="absolute inset-0 flex items-center">
          <span className="border-border w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card text-muted-foreground px-3">또는</span>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="text-center text-sm"
      >
        <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
        <Link
          href="/login"
          className="text-primary hover:text-primary/80 focus-visible:ring-primary rounded-sm font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          로그인
        </Link>
      </motion.div>
    </motion.div>
  );
}
