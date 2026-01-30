import { loadServerConfig } from "@/lib/config-server";
import { fetchAssistantDataServer } from "@/lib/assistant-api-server";

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

  // Get API URL and assistant ID from search params or env
  const apiUrl = params.apiUrl || process.env.NEXT_PUBLIC_API_URL || "";
  const assistantIdOrGraphId = params.assistantId || process.env.NEXT_PUBLIC_ASSISTANT_ID || "";
  const apiKey = process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

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
