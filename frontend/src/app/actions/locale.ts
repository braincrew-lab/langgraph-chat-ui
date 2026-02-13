"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, locales, type Locale } from "@/i18n/config";

export async function setLocaleAction(locale: Locale) {
  if (!locales.includes(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });
}
