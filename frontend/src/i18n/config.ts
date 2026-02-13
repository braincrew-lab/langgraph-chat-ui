export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ko";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
