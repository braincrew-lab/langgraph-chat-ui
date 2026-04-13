"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { LoaderCircle, ArrowRight, Key } from "lucide-react";
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

export function ApiKeyLoginForm() {
  const router = useRouter();
  const { branding } = useAuthContext();
  const tc = useTranslations("common");

  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    setIsLoading(true);

    try {
      // Validate the API key via server action
      const response = await fetch("/api/auth/validate-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (data.valid) {
        // Store API key in cookie via the existing connection mechanism
        document.cookie = `lg_apiKey=${encodeURIComponent(apiKey.trim())}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Invalid API key — could not connect to LangGraph server");
      }
    } catch {
      setError("Failed to validate API key. Please check your connection.");
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
          <p className="text-muted-foreground text-sm">
            Enter your API key to connect
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
            htmlFor="apiKey"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Key
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            API Key
          </label>
          <Input
            ref={inputRef}
            id="apiKey"
            name="apiKey"
            type="password"
            autoComplete="off"
            placeholder="lsv2_pt_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            disabled={isLoading}
            size="lg"
          />
          <p className="text-muted-foreground text-xs">
            Your LangGraph Cloud or LangSmith API key
          </p>
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
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>Connect</span>
                <ArrowRight
                  className="ml-2 h-4 w-4"
                  aria-hidden="true"
                />
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
