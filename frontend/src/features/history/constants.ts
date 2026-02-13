// Sidebar dimensions
export const SIDEBAR_WIDTH = 300;

// Thread display settings
export const MAX_THREAD_TITLE_LENGTH = 16;
export const SKELETON_LOADING_COUNT = 30;

// Styling constants
export const SCROLLBAR_STYLES =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent";

export const THREAD_ITEM_PADDING = "px-3 py-2";
export const ICON_SIZE_SM = "size-5";
export const BUTTON_SIZE_SM = "h-7 w-7";

// UI Text - i18n key references (used with t(UI_TEXT.xxx) pattern)
export const UI_TEXT = {
  newChat: "newChat",
  rename: "rename",
  delete: "delete",
  deleteConfirm: "deleteConfirm",
  deleteSuccess: "deleteSuccess",
  deleteError: "deleteError",
  updateSuccess: "updateSuccess",
  updateError: "updateError",
} as const;
