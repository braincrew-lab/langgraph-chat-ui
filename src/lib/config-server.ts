import { ChatConfig } from "./config";
import { fullConfig } from "@/configs";

/**
 * Loads configuration from src/configs on the server side.
 *
 * @returns The site configuration
 */
export async function loadServerConfig(): Promise<ChatConfig> {
  return fullConfig as unknown as ChatConfig;
}
