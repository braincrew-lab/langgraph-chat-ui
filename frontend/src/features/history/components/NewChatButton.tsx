import { SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { UI_TEXT, THREAD_ITEM_PADDING, ICON_SIZE_SM } from "../constants";

interface NewChatButtonProps {
  onClick: () => void;
}

export function NewChatButton({ onClick }: NewChatButtonProps) {
  const t = useTranslations("history");

  return (
    <div
      className={`flex h-10 w-full cursor-pointer items-center gap-2 rounded-md ${THREAD_ITEM_PADDING} hover:bg-accent focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none`}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      onClick={onClick}
    >
      <SquarePen className={ICON_SIZE_SM} />
      <span className="text-sm font-medium">{t(UI_TEXT.newChat)}</span>
    </div>
  );
}
