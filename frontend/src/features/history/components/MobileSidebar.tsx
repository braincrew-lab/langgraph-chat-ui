import { Thread } from "@langchain/langgraph-sdk";
import { useTranslations } from "next-intl";
import { Separator } from "@/shared/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/shared/components/ui/sheet";
import { NewChatButton } from "./NewChatButton";
import { ThreadList } from "./ThreadList";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface MobileSidebarProps {
  threads: Thread[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  onThreadClick: () => void;
}

export function MobileSidebar({
  threads,
  isOpen,
  onOpenChange,
  onNewChat,
  onThreadClick,
}: MobileSidebarProps) {
  const t = useTranslations("history");

  return (
    <div className="lg:hidden">
      <Sheet
        open={isOpen}
        onOpenChange={onOpenChange}
      >
        <SheetContent
          side="left"
          className="flex flex-col gap-4 lg:hidden"
        >
          <VisuallyHidden>
            <SheetTitle>{t("chatHistory")}</SheetTitle>
          </VisuallyHidden>

          {/* New Chat button */}
          <NewChatButton onClick={onNewChat} />

          {/* Separator */}
          <Separator />

          {/* Thread list */}
          <ThreadList
            threads={threads}
            onThreadClick={onThreadClick}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
