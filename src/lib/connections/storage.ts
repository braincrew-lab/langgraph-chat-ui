import { saveActiveConnectionToCookies } from "./cookies";

const STORAGE_KEY = "lg:connections";

export interface Connection {
  id: string;
  name: string;
  apiUrl: string;
  assistantId?: string;
  apiKey?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ConnectionStorage {
  connections: Connection[];
  activeConnectionId: string;
}

// Create default connection from env vars
export function getDefaultConnection(): Connection {
  const envAssistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID?.trim();
  return {
    id: "default",
    name: "Default (from .env)",
    apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024",
    assistantId: envAssistantId || undefined,
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

// Load connections from localStorage
export function loadConnections(): ConnectionStorage {
  if (typeof window === "undefined") {
    return {
      connections: [],
      activeConnectionId: "default",
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        connections: [],
        activeConnectionId: "default",
      };
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading connections:", error);
    return {
      connections: [],
      activeConnectionId: "default",
    };
  }
}

// Save connections to localStorage
export function saveConnections(storage: ConnectionStorage): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error("Error saving connections:", error);
  }
}

// Add new connection
export function addConnection(
  name: string,
  apiUrl: string,
  assistantId?: string,
  apiKey?: string
): Connection {
  const newConnection: Connection = {
    id: `conn-${Date.now()}`,
    name,
    apiUrl,
    assistantId,
    apiKey,
    isDefault: false,
    isActive: false,
    createdAt: new Date().toISOString(),
  };

  const storage = loadConnections();
  storage.connections.push(newConnection);
  saveConnections(storage);

  return newConnection;
}

// Delete connection
export function deleteConnection(connectionId: string): void {
  const storage = loadConnections();
  storage.connections = storage.connections.filter((c) => c.id !== connectionId);

  // If deleted connection was active, switch to default
  if (storage.activeConnectionId === connectionId) {
    storage.activeConnectionId = "default";
  }

  saveConnections(storage);
}

// Get active connection (combines default + custom)
export function getActiveConnection(): Connection {
  const storage = loadConnections();
  const defaultConn = getDefaultConnection();

  // If active is default, return env connection
  if (storage.activeConnectionId === "default") {
    return defaultConn;
  }

  // Find active custom connection
  const activeConn = storage.connections.find(
    (c) => c.id === storage.activeConnectionId
  );

  return activeConn || defaultConn;
}

// Get all connections (default + custom)
export function getAllConnections(): Connection[] {
  const storage = loadConnections();
  const defaultConn = getDefaultConnection();

  // Mark active connection
  defaultConn.isActive = storage.activeConnectionId === "default";
  const customConnections = storage.connections.map((c) => ({
    ...c,
    isActive: c.id === storage.activeConnectionId,
  }));

  return [defaultConn, ...customConnections];
}

// Switch active connection
export function switchConnection(connectionId: string): void {
  const storage = loadConnections();
  storage.activeConnectionId = connectionId;
  saveConnections(storage);

  // Sync to cookies for SSR
  const activeConn = getActiveConnection();
  saveActiveConnectionToCookies({
    id: activeConn.id,
    apiUrl: activeConn.apiUrl,
    assistantId: activeConn.assistantId,
    apiKey: activeConn.apiKey,
  });
}

// Sync active connection to cookies (call on app init)
export function syncActiveConnectionToCookies(): void {
  const activeConn = getActiveConnection();
  saveActiveConnectionToCookies({
    id: activeConn.id,
    apiUrl: activeConn.apiUrl,
    assistantId: activeConn.assistantId,
    apiKey: activeConn.apiKey,
  });
}
