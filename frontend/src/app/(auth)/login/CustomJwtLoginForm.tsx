"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { LoaderCircle, ArrowRight, KeyRound } from "lucide-react";
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

export function CustomJwtLoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { branding } = useAuthContext();
  const tc = useTranslations("common");

  const issuerName =
    process.env.NEXT_PUBLIC_JWT_ISSUER_NAME || "Identity Provider";

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/auth/callback?action=authorize", {
        method: "GET",
      });
      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        setError(data.error || "Failed to start authentication");
        setIsLoading(false);
      }
    } catch {
      setError("Failed to connect to authentication service");
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
          <p className="text-muted-foreground text-sm">
            Sign in with your identity provider
          </p>
        </div>
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="border-destructive/35 bg-destructive/10 text-destructive rounded-xl border p-3 text-sm"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <Button
          onClick={handleLogin}
          className="h-11 w-full rounded-xl font-medium transition-colors"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <LoaderCircle
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <span>Redirecting...</span>
            </>
          ) : (
            <>
              <KeyRound
                className="mr-2 h-4 w-4"
                aria-hidden="true"
              />
              <span>Sign in with {issuerName}</span>
              <ArrowRight
                className="ml-2 h-4 w-4"
                aria-hidden="true"
              />
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
