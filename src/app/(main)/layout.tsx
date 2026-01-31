import { cookies } from "next/headers";
import { loadServerConfig } from "@/lib/config-server";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connection-cookies";
import { MainLayoutClient } from "@/components/layout/MainLayoutClient";
import { getAllSettings } from "@/lib/services/settings.service";

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

  // Priority: Admin default connection (if selection disabled) > Cookies > Environment variables
  const adminDefaultApiUrl = globalSettings["features.defaultConnectionApiUrl"];
  const connectionSelectionEnabled = globalSettings["features.enableConnectionSelection"];

  // If connection selection is disabled and admin set a default, use that
  const apiUrl = !connectionSelectionEnabled && adminDefaultApiUrl
    ? adminDefaultApiUrl
    : (cookieApiUrl || process.env.NEXT_PUBLIC_API_URL || "");
  const assistantId = cookieAssistantId || "";
  const apiKey = cookieApiKey || process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY || "";

  const initialConnection = {
    apiUrl,
    assistantId,
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
