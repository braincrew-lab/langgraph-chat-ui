"use server";

import { cookies } from "next/headers";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connections/cookies";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Server action to update connection settings in cookies
 */
export async function updateConnectionAction(connection: {
  apiUrl: string;
  assistantId?: string;
  apiKey?: string;
}) {
  const cookieStore = await cookies();

  // Set cookies with proper options
  cookieStore.set(CONNECTION_COOKIE_NAMES.apiUrl, connection.apiUrl, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  if (connection.assistantId) {
    cookieStore.set(CONNECTION_COOKIE_NAMES.assistantId, connection.assistantId, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  } else {
    cookieStore.delete(CONNECTION_COOKIE_NAMES.assistantId);
  }

  if (connection.apiKey) {
    cookieStore.set(CONNECTION_COOKIE_NAMES.apiKey, connection.apiKey, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }

  return { success: true };
}

/**
 * Server action to update only the assistantId
 */
export async function updateAssistantIdAction(assistantId: string | null) {
  const cookieStore = await cookies();

  if (assistantId) {
    cookieStore.set(CONNECTION_COOKIE_NAMES.assistantId, assistantId, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  } else {
    cookieStore.delete(CONNECTION_COOKIE_NAMES.assistantId);
  }

  return { success: true };
}

/**
 * Server action to get current connection from cookies
 */
export async function getConnectionAction() {
  const cookieStore = await cookies();

  return {
    apiUrl: cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value || null,
    assistantId: cookieStore.get(CONNECTION_COOKIE_NAMES.assistantId)?.value || null,
    apiKey: cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value || null,
  };
}

/**
 * Server action to clear all connection cookies (reset to defaults)
 */
export async function clearConnectionCookiesAction() {
  const cookieStore = await cookies();

  cookieStore.delete(CONNECTION_COOKIE_NAMES.apiUrl);
  cookieStore.delete(CONNECTION_COOKIE_NAMES.assistantId);
  cookieStore.delete(CONNECTION_COOKIE_NAMES.apiKey);
  cookieStore.delete(CONNECTION_COOKIE_NAMES.connectionId);

  return { success: true };
}
