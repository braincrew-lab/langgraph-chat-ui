// Type compatibility shim for @langchain/langgraph-sdk 1.x
// This file provides backward-compatible type aliases

import type { Data } from "@langchain/core/messages";

declare module "@langchain/core/messages" {
  // Re-export Base64ContentBlock at the top level for backward compatibility
  export type Base64ContentBlock = Data.Base64ContentBlock;
}
