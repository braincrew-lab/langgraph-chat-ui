"use client";

import React from "react";
import { ArtifactProvider } from "@/components/thread/artifact";
import { StreamProvider, type ConnectionConfig } from "@/providers/Stream";
import { ThreadContent } from "@/components/thread/ThreadContent";
import type { ServerAssistantData } from "@/lib/assistant-api-server";

interface ChatContentProps {
  initialAssistantData?: ServerAssistantData;
  initialConnection: ConnectionConfig;
}

export function ChatContent({
  initialAssistantData,
  initialConnection,
}: ChatContentProps) {
  return (
    <StreamProvider
      initialAssistantData={initialAssistantData}
      connection={initialConnection}
    >
      <ArtifactProvider>
        <ThreadContent />
      </ArtifactProvider>
    </StreamProvider>
  );
}
