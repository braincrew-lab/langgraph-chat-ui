"use client";

import React from "react";
import { ArtifactProvider } from "@/features/chat/components/Artifact";
import { StreamProvider, type ConnectionConfig } from "@/providers/Stream";
import { ThreadContent } from "@/features/chat/components/ThreadContent";
import type { ServerAssistantData } from "@/providers/AssistantConfig";

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
