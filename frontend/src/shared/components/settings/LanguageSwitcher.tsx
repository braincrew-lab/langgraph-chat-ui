"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { setLocaleAction } from "@/app/actions/locale";
import type { Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("settings");

  const handleChange = async (newLocale: Locale) => {
    await setLocaleAction(newLocale);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Label>{t("language")}</Label>
      <p className="text-muted-foreground text-sm">{t("languageDesc")}</p>
      <div className="flex gap-2">
        <Button
          variant={locale === "en" ? "default" : "outline"}
          onClick={() => handleChange("en")}
          className="flex-1"
        >
          English
        </Button>
        <Button
          variant={locale === "ko" ? "default" : "outline"}
          onClick={() => handleChange("ko")}
          className="flex-1"
        >
          한국어
        </Button>
      </div>
    </div>
  );
}
