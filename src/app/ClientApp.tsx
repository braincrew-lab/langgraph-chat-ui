"use client";

import React from "react";

import { Thread } from "@/components/thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { Toaster } from "@/components/ui/sonner";
import { ChatConfig } from "@/lib/config";
import { SettingsProvider } from "@/providers/Settings";
import { StreamProvider, type ConnectionConfig } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import type { ServerAssistantData } from "@/lib/assistant-api-server";

interface ClientAppProps {
  initialConfig: ChatConfig;
  initialAssistantData?: ServerAssistantData;
  initialConnection: ConnectionConfig;
}

export default function ClientApp({ initialConfig, initialAssistantData, initialConnection }: ClientAppProps) {
  // Use connection as key to force remount when connection changes
  const connectionKey = `${initialConnection.apiUrl}:${initialConnection.assistantId}`;

  return (
    <React.Suspense fallback={<div></div>}>
      <Toaster />
      <SettingsProvider initialConfig={initialConfig}>
        <ThreadProvider key={connectionKey} connection={initialConnection}>
          <StreamProvider
            initialAssistantData={initialAssistantData}
            connection={initialConnection}
          >
            <ArtifactProvider>
              <Thread />
            </ArtifactProvider>
          </StreamProvider>
        </ThreadProvider>
      </SettingsProvider>
    </React.Suspense>
  );
}
