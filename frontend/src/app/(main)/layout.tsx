import { cookies } from "next/headers";
import { loadServerConfig } from "@/lib/config/server";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connections/cookies";
import { MainLayoutClient } from "@/shared/components/layout/MainLayoutClient";
import { getAllSettings } from "@/lib/services/settings.service";
import { resolveAssistantId } from "@/lib/api/assistant.server";
import { resolveApiUrl } from "@/lib/connections/resolve";

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
  const cookieAssistantId = cookieStore.get(
    CONNECTION_COOKIE_NAMES.assistantId,
  )?.value;
  const cookieApiKey = cookieStore.get(CONNECTION_COOKIE_NAMES.apiKey)?.value;

  // Priority: Cookies > DB admin settings > Server env > Public env
  const adminDefaultApiUrl = globalSettings["features.defaultConnectionApiUrl"];
  const adminDefaultGraphId = globalSettings["features.defaultGraphId"];

  const apiUrl = resolveApiUrl(cookieApiUrl, adminDefaultApiUrl);
  const assistantIdOrGraphId =
    cookieAssistantId ||
    adminDefaultGraphId ||
    process.env.NEXT_PUBLIC_ASSISTANT_ID ||
    "";
  const apiKey =
    cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  // Resolve graph_id to UUID if needed
  const resolvedAssistantId = assistantIdOrGraphId
    ? await resolveAssistantId(
        apiUrl,
        assistantIdOrGraphId,
        apiKey || undefined,
      )
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
