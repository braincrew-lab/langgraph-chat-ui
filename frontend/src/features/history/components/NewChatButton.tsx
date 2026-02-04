import { SquarePen } from "lucide-react";
import { UI_TEXT, THREAD_ITEM_PADDING, ICON_SIZE_SM } from "../constants";

interface NewChatButtonProps {
  onClick: () => void;
}

export function NewChatButton({ onClick }: NewChatButtonProps) {
  return (
    <div
      className={`flex h-10 w-full cursor-pointer items-center gap-2 rounded-md ${THREAD_ITEM_PADDING} hover:bg-accent transition-colors`}
      onClick={onClick}
    >
      <SquarePen className={ICON_SIZE_SM} />
      <span className="text-sm font-medium">{UI_TEXT.newChat}</span>
    </div>
  );
}
