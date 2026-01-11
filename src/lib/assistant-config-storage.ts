const STORAGE_KEY = "lg:assistant-config";

export interface StoredAssistantConfig {
  [key: string]: unknown;
}

export function loadAssistantConfig(): StoredAssistantConfig {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Error loading assistant config:", error);
    return {};
  }
}

export function saveAssistantConfig(config: StoredAssistantConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Error saving assistant config:", error);
  }
}

export function clearAssistantConfig(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing assistant config:", error);
  }
}
