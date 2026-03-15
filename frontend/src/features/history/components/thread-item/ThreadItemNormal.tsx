import { ThreadItemMenu } from "./ThreadItemMenu";
import { truncateText } from "../../utils/threadHelpers";
import { MAX_THREAD_TITLE_LENGTH, THREAD_ITEM_PADDING } from "../../constants";

interface ThreadItemNormalProps {
  displayText: string;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete?: () => void;
}

export function ThreadItemNormal({
  displayText,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: ThreadItemNormalProps) {
  return (
    <div
      className={`flex w-full cursor-pointer items-center justify-between rounded-md ${THREAD_ITEM_PADDING} hover:bg-accent focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        isActive ? "bg-accent" : ""
      }`}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      onClick={onSelect}
    >
      <p className="min-w-0 flex-1 truncate text-sm text-ellipsis">
        {truncateText(displayText, MAX_THREAD_TITLE_LENGTH)}
      </p>
      <ThreadItemMenu
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  );
}
