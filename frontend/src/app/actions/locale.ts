"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, locales, type Locale } from "@/i18n/config";
import { COOKIES } from "@/lib/constants";

export async function setLocaleAction(locale: Locale) {
  if (!locales.includes(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: COOKIES.MAX_AGE,
    sameSite: "lax",
  });
}
