export const locales = ["en", "ko"] as const;
export type Locale = (typeof locales)[number];

const envLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale | undefined;
export const defaultLocale: Locale =
  envLocale && locales.includes(envLocale) ? envLocale : "en";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
