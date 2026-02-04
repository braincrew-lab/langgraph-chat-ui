/**
 * Application-wide constants
 * Centralized location for magic numbers and strings
 */

/**
 * UI Layout Constants
 */
export const UI = {
  /** Width of the chat history sidebar in pixels */
  CHAT_SIDEBAR_WIDTH: 300,
  /** Width of the tracing sidebar in pixels */
  TRACING_SIDEBAR_WIDTH: 400,
  /** Maximum height of the chat textarea in pixels */
  CHAT_TEXTAREA_MAX_HEIGHT: 490,
  /** Logo scale factor for splash screen */
  LOGO_SCALE_FACTOR: 1.5,
  /** Maximum length for tool result truncation */
  MAX_TOOL_RESULT_LENGTH: 100,
  /** Maximum height for TODO box in pixels */
  TODO_BOX_MAX_HEIGHT: 300,
} as const;

/**
 * Timing Constants
 */
export const TIMING = {
  /** Delay before fetching threads after creation (milliseconds) */
  THREAD_FETCH_DELAY: 4000,
  /** Polling interval for LangSmith runs (milliseconds) */
  POLLING_INTERVAL: 5000,
  /** Delay before refetching LangSmith data after streaming ends */
  LANGSMITH_REFETCH_DELAY: 2000,
  /** Default animation duration (milliseconds) */
  ANIMATION_DURATION: 300,
} as const;

/**
 * Stream configuration options
 * Used for consistent streaming behavior across components
 */
export const STREAM_OPTIONS = {
  streamMode: ["values", "custom"] as const,
  streamSubgraphs: true,
  streamResumable: true,
} as const;

/**
 * Placeholder text for chat input
 * TODO: Replace with i18n system for localization
 */
export const PLACEHOLDERS = {
  CHAT_INPUT: "무엇이든 물어보세요",
} as const;
