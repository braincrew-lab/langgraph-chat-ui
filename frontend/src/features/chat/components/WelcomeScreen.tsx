import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";
import type { ChatConfig } from "@/lib/config/client";

interface WelcomeScreenProps {
  config: ChatConfig;
  chatWidth: "default" | "wide";
  isSchemaLoading: boolean;
}

export function WelcomeScreen({
  config,
  chatWidth,
  isSchemaLoading,
}: WelcomeScreenProps) {
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
          <p className="text-muted-foreground text-center text-base">
            {config.branding.description}
          </p>
        )}
      </div>
      {isSchemaLoading && (
        <LoaderCircle className="text-muted-foreground h-6 w-6 animate-spin" />
      )}
    </div>
  );
}
