import { siteConfig } from "./site";
import { chatOpeners } from "./chat-openers";

export { siteConfig, chatOpeners };

export const fullConfig = {
  ...siteConfig,
  branding: {
    ...siteConfig.branding,
    chatOpeners: [...chatOpeners],
  },
  langsmithEnabled: false,
};

export type FullConfig = typeof fullConfig;
