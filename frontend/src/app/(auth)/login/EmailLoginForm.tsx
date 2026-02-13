"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { LoaderCircle, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
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

export function EmailLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { branding } = useAuthContext();
  const t = useTranslations('auth');
  const tc = useTranslations('common');

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
        setError(t('emailLogin.sendError'));
      } else {
        setEmailSent(true);
      }
    } catch {
      setError(t('login.genericError'));
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-muted/70 border-border flex h-16 w-16 items-center justify-center rounded-full border"
          >
            <CheckCircle2 className="text-primary h-8 w-8" />
          </motion.div>
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('emailLogin.checkEmail')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('emailLogin.linkSent')}
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
            {t('emailLogin.linkSentTo')}
          </p>
          <p className="mt-4">{t('emailLogin.clickLink')}</p>
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
            {t('emailLogin.tryDifferentEmail')}
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
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.logoPath}
            alt={`${branding.appName} ${tc('logo')}`}
            width={branding.logoWidth * 2}
            height={branding.logoHeight * 2}
            className="flex-shrink-0"
          />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {branding.appName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('emailLogin.subtitle')}
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
            {t('login.email')}
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
            className="h-11 w-full rounded-xl font-medium transition-colors"
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                <span>{t('emailLogin.sending')}</span>
              </>
            ) : (
              <>
                <span>{t('emailLogin.getLoginLink')}</span>
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
          {t('emailLogin.linkWillBeSent')}
          <br />
          {t('emailLogin.secureLogin')}
        </p>
      </motion.div>
    </motion.div>
  );
}
