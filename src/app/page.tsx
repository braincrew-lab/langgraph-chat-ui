import { cookies } from "next/headers";
import { loadServerConfig } from "@/lib/config-server";
import { fetchAssistantDataServer } from "@/lib/assistant-api-server";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connection-cookies";

import ClientApp from "./ClientApp";

// Force dynamic rendering to avoid build-time errors
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    assistantId?: string;
    apiUrl?: string;
  }>;
}

export default async function DemoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialConfig = await loadServerConfig();

  // Read connection settings from cookies (SSR support)
  const cookieStore = await cookies();
  const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
  const cookieAssistantId = cookieStore.get(CONNECTION_COOKIE_NAMES.assistantId)?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  // Priority: URL params > Cookies > Environment variables
  const apiUrl = params.apiUrl || cookieApiUrl || process.env.NEXT_PUBLIC_API_URL || "";
  const assistantIdOrGraphId = params.assistantId || cookieAssistantId || process.env.NEXT_PUBLIC_ASSISTANT_ID || "";
  const apiKey = cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  // Fetch assistant data on the server (parallel fetching)
  const initialAssistantData = await fetchAssistantDataServer(
    apiUrl,
    assistantIdOrGraphId,
    apiKey || undefined
  );

  return (
    <ClientApp
      initialConfig={initialConfig}
      initialAssistantData={initialAssistantData}
    />
  );
}
