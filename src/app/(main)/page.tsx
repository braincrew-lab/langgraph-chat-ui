import { cookies } from "next/headers";
import { fetchAssistantDataServer } from "@/lib/api/assistant.server";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connections/cookies";
import { ChatContent } from "@/features/chat/components/chat/ChatContent";
import { getAllSettings } from "@/lib/services/settings.service";
import { resolveApiUrl } from "@/lib/connections/resolve";

// Force dynamic rendering to avoid build-time errors
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  // Fetch global settings
  const globalSettings = await getAllSettings();

  // Read connection settings from cookies (SSR support)
  const cookieStore = await cookies();
  const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
  const cookieAssistantId = cookieStore.get(
    CONNECTION_COOKIE_NAMES.assistantId,
  )?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  // Global settings for feature control
  const graphSelectionEnabled = globalSettings["features.enableGraphSelection"];
  const adminDefaultApiUrl = globalSettings["features.defaultConnectionApiUrl"];
  const adminDefaultGraphId = globalSettings["features.defaultGraphId"];

  // Priority: Cookies > DB admin settings > Server env > Public env
  const apiUrl = resolveApiUrl(cookieApiUrl, adminDefaultApiUrl);
  const assistantId = cookieAssistantId || adminDefaultGraphId || "";
  const apiKey =
    cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  // Fetch assistant data on the server (parallel fetching)
  const initialAssistantData = await fetchAssistantDataServer(
    apiUrl,
    assistantId,
    apiKey || undefined,
  );

  // Debug logging
  console.log("[page.tsx] apiUrl:", apiUrl);
  console.log("[page.tsx] original assistantId:", assistantId);
  console.log(
    "[page.tsx] resolved assistantId:",
    initialAssistantData.assistantId,
  );

  const initialConnection = {
    apiUrl,
    // Use resolved UUID from server, fallback to original value
    assistantId: initialAssistantData.assistantId || assistantId,
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
