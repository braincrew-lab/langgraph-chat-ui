import { cookies } from "next/headers";
import { fetchAssistantDataServer } from "@/lib/assistant-api-server";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connection-cookies";
import { ChatContent } from "@/components/chat/ChatContent";
import { getAllSettings } from "@/lib/services/settings.service";

// Force dynamic rendering to avoid build-time errors
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  // Fetch global settings
  const globalSettings = await getAllSettings();

  // Read connection settings from cookies (SSR support)
  const cookieStore = await cookies();
  const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
  const cookieAssistantId = cookieStore.get(CONNECTION_COOKIE_NAMES.assistantId)?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  // Global settings for feature control
  const connectionSelectionEnabled = globalSettings["features.enableConnectionSelection"];
  const graphSelectionEnabled = globalSettings["features.enableGraphSelection"];
  const adminDefaultApiUrl = globalSettings["features.defaultConnectionApiUrl"];
  const adminDefaultGraphId = globalSettings["features.defaultGraphId"];

  // Priority: Admin default (if selection disabled) > Cookies > Environment variables
  const apiUrl = !connectionSelectionEnabled && adminDefaultApiUrl
    ? adminDefaultApiUrl
    : (cookieApiUrl || process.env.NEXT_PUBLIC_API_URL || "");
  const assistantId = cookieAssistantId || "";
  const apiKey = cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  // Fetch assistant data on the server (parallel fetching)
  const initialAssistantData = await fetchAssistantDataServer(
    apiUrl,
    assistantId,
    apiKey || undefined
  );

  const initialConnection = {
    apiUrl,
    assistantId,
    apiKey,
  };

  return (
    <ChatContent
      initialAssistantData={initialAssistantData}
      initialConnection={initialConnection}
      enableGraphSelection={graphSelectionEnabled}
      defaultGraphId={adminDefaultGraphId}
    />
  );
}
