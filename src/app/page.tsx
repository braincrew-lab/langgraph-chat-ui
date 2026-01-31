import { cookies } from "next/headers";
import { loadServerConfig } from "@/lib/config-server";
import { fetchAssistantDataServer } from "@/lib/assistant-api-server";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connection-cookies";

import ClientApp from "./ClientApp";

// Force dynamic rendering to avoid build-time errors
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const initialConfig = await loadServerConfig();

  // Read connection settings from cookies (SSR support)
  const cookieStore = await cookies();
  const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
  const cookieAssistantId = cookieStore.get(CONNECTION_COOKIE_NAMES.assistantId)?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  // Priority: Cookies > Environment variables (URL params removed)
  const apiUrl = cookieApiUrl || process.env.NEXT_PUBLIC_API_URL || "";
  const assistantId = cookieAssistantId || process.env.NEXT_PUBLIC_ASSISTANT_ID || "";
  const apiKey = cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  // Fetch assistant data on the server (parallel fetching)
  const initialAssistantData = await fetchAssistantDataServer(
    apiUrl,
    assistantId,
    apiKey || undefined
  );

  // Pass connection from server to client
  const initialConnection = {
    apiUrl,
    assistantId,
    apiKey,
  };

  return (
    <ClientApp
      initialConfig={initialConfig}
      initialAssistantData={initialAssistantData}
      initialConnection={initialConnection}
    />
  );
}
