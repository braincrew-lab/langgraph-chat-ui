/**
 * Configuration module
 * - client: Client-side config loading
 * - server: Server-side config with DB overrides
 */
export * from "./client";
export { loadServerConfig } from "./server";
