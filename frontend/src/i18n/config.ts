export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];

const envLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE as Locale | undefined;
export const defaultLocale: Locale =
  envLocale && locales.includes(envLocale) ? envLocale : "ko";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
