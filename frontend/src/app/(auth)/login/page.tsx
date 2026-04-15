"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  LoaderCircle,
  CheckCircle2,
  Mail,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useAuthContext } from "../AuthLayoutClient";
import { OAuthLoginForm } from "./OAuthLoginForm";
import { EmailLoginForm } from "./EmailLoginForm";
import { CustomJwtLoginForm } from "./CustomJwtLoginForm";
import { ApiKeyLoginForm } from "./ApiKeyLoginForm";

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

function CredentialsLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const registered = searchParams.get("registered") === "true";
  const { allowRegistration, branding } = useAuthContext();
  const t = useTranslations("auth");
  const tc = useTranslations("common");

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
        setError(t("login.invalidCredentials"));
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(t("login.genericError"));
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
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center gap-4 pb-2"
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.logoPath}
            alt={`${branding.appName} ${tc("logo")}`}
            width={branding.logoWidth * 2}
            height={branding.logoHeight * 2}
            className="flex-shrink-0"
          />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {branding.appName}
          </h1>
          <p className="text-muted-foreground text-sm">{t("login.subtitle")}</p>
        </div>
      </motion.div>

      {/* Registration success message */}
      {registered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-muted/60 border-border text-foreground flex items-center gap-2 rounded-xl border p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2
            className="h-4 w-4 flex-shrink-0"
            aria-hidden="true"
          />
          <span>{t("login.registrationComplete")}</span>
        </motion.div>
      )}

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
            className="border-destructive/35 bg-destructive/10 text-destructive rounded-xl border p-3 text-sm"
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
            {t("login.email")}
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
            {t("login.password")}
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t("login.passwordPlaceholder")}
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
            className="h-11 w-full rounded-xl font-medium transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                <span>{t("login.signingIn")}</span>
              </>
            ) : (
              <>
                <span>{t("login.signIn")}</span>
                <ArrowRight
                  className="ml-2 h-4 w-4"
                  aria-hidden="true"
                />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {allowRegistration && (
        <>
          <motion.div
            variants={itemVariants}
            className="relative"
          >
            <div className="absolute inset-0 flex items-center">
              <span className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card text-muted-foreground px-3">
                {tc("or")}
              </span>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="text-center text-sm"
          >
            <span className="text-muted-foreground">
              {t("login.noAccount")}{" "}
            </span>
            <Link
              href="/register"
              className="text-primary hover:text-primary/80 focus-visible:ring-primary rounded-sm font-medium transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("login.signUp")}
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
        <div className="bg-muted h-14 w-14 animate-pulse rounded-full" />
        <div className="space-y-2 text-center">
          <div className="bg-muted mx-auto h-7 w-40 animate-pulse rounded" />
          <div className="bg-muted mx-auto h-4 w-48 animate-pulse rounded" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-muted h-11 animate-pulse rounded-xl" />
        <div className="bg-muted h-11 animate-pulse rounded-xl" />
        <div className="bg-muted h-11 animate-pulse rounded-xl" />
      </div>
    </div>
  );
}

function LoginForm() {
  const { authMode } = useAuthContext();

  switch (authMode) {
    case "oauth":
      return <OAuthLoginForm />;
    case "email":
      return <EmailLoginForm />;
    case "custom-jwt":
      return <CustomJwtLoginForm />;
    case "api-key":
      return <ApiKeyLoginForm />;
    case "credentials":
    default:
      return <CredentialsLoginForm />;
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
