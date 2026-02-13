import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // 1. Cookie
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value as Locale | undefined;
  if (cookieLocale && locales.includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`./messages/${cookieLocale}.json`)).default,
    };
  }

  // 2. Accept-Language
  const acceptLang = headerStore.get("accept-language") ?? "";
  const detected = acceptLang
    .split(",")
    .map((part) => part.split(";")[0].trim().substring(0, 2).toLowerCase())
    .find((lang) => locales.includes(lang as Locale)) as Locale | undefined;

  const locale = detected ?? defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
