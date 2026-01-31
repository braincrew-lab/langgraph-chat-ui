"use client";

import React from "react";
import { ArtifactProvider } from "@/components/thread/artifact";
import { StreamProvider, type ConnectionConfig } from "@/providers/Stream";
import { ThreadContent } from "@/components/thread/ThreadContent";
import type { ServerAssistantData } from "@/lib/assistant-api-server";

interface ChatContentProps {
  initialAssistantData?: ServerAssistantData;
  initialConnection: ConnectionConfig;
  enableGraphSelection?: boolean;
  defaultGraphId?: string;
}

export function ChatContent({
  initialAssistantData,
  initialConnection,
  enableGraphSelection = true,
  defaultGraphId = "",
}: ChatContentProps) {
  return (
    <StreamProvider
      initialAssistantData={initialAssistantData}
      connection={initialConnection}
      enableGraphSelection={enableGraphSelection}
      defaultGraphId={defaultGraphId}
    >
      <ArtifactProvider>
        <ThreadContent />
      </ArtifactProvider>
    </StreamProvider>
  );
}
