import { cookies } from "next/headers";
import { loadServerConfig } from "@/lib/config/server";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connections/cookies";
import { MainLayoutClient } from "@/shared/components/layout/MainLayoutClient";
import { getAllSettings } from "@/lib/services/settings.service";
import { resolveAssistantId } from "@/lib/api/assistant.server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialConfig = await loadServerConfig();
  const globalSettings = await getAllSettings();

  // Read connection settings from cookies (SSR support)
  const cookieStore = await cookies();
  const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
  const cookieAssistantId = cookieStore.get(CONNECTION_COOKIE_NAMES.assistantId)?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  // Priority: Admin default (if set) > Cookies > Environment variables
  // 서버 전역값이 설정되어 있으면 항상 우선 적용
  const adminDefaultApiUrl = globalSettings["features.defaultConnectionApiUrl"];
  const adminDefaultGraphId = globalSettings["features.defaultGraphId"];

  const apiUrl = adminDefaultApiUrl
    ? adminDefaultApiUrl
    : (cookieApiUrl || process.env.NEXT_PUBLIC_API_URL || "");
  const assistantIdOrGraphId = adminDefaultGraphId
    ? adminDefaultGraphId
    : (cookieAssistantId || "");
  const apiKey = cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  // Resolve graph_id to UUID if needed
  const resolvedAssistantId = assistantIdOrGraphId
    ? await resolveAssistantId(apiUrl, assistantIdOrGraphId, apiKey || undefined)
    : null;

  const initialConnection = {
    apiUrl,
    assistantId: resolvedAssistantId || assistantIdOrGraphId,
    apiKey,
  };

  return (
    <MainLayoutClient
      initialConfig={initialConfig}
      initialConnection={initialConnection}
      globalSettings={globalSettings}
    >
      {children}
    </MainLayoutClient>
  );
}
