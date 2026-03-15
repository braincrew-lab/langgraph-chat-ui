import { siteConfig } from "./site";

export { siteConfig };

export const fullConfig = {
  ...siteConfig,
  langsmithEnabled: false,
};

export type FullConfig = typeof fullConfig;
