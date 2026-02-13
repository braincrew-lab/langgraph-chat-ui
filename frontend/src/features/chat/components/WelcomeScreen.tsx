import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { LoaderCircle, BookOpen } from "lucide-react";
import { ChatOpeners } from "./input/ChatOpeners";
import type { ChatConfig } from "@/lib/config/client";

interface WelcomeScreenProps {
  config: ChatConfig;
  chatWidth: "default" | "wide";
  isFormMode: boolean;
  isSchemaLoading: boolean;
  isLoading: boolean;
  isAssistantSelected: boolean;
  onSelectOpener: (opener: string) => void;
  onFullDescriptionOpen: () => void;
}

export function WelcomeScreen({
  config,
  chatWidth,
  isFormMode,
  isSchemaLoading,
  isLoading,
  isAssistantSelected,
  onSelectOpener,
  onFullDescriptionOpen,
}: WelcomeScreenProps) {
  const t = useTranslations("chat");

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col items-center gap-6",
        chatWidth === "default" ? "max-w-3xl" : "max-w-5xl",
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.branding.logoPath}
            alt="Logo"
            width={config.branding.logoWidth * 1.5}
            height={config.branding.logoHeight * 1.5}
            className="flex-shrink-0"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            {config.branding.appName}
          </h1>
        </div>
        {config.branding.description && (
          <p className="text-muted-foreground text-center text-sm">
            {config.branding.description}
          </p>
        )}
        {config.branding.fullDescription && (
          <button
            onClick={onFullDescriptionOpen}
            className="text-primary hover:text-primary/80 flex items-center gap-2 text-sm transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            <span>{t("viewFullDescription")}</span>
          </button>
        )}
      </div>
      {isSchemaLoading && (
        <LoaderCircle className="text-muted-foreground h-6 w-6 animate-spin" />
      )}
      {config.branding.chatOpeners &&
        config.branding.chatOpeners.length > 0 &&
        !isFormMode &&
        !isSchemaLoading && (
          <ChatOpeners
            disabled={isLoading || !isAssistantSelected}
            chatOpeners={config.branding.chatOpeners}
            onSelectOpener={onSelectOpener}
          />
        )}
    </div>
  );
}
