import { useContext } from "react";
import StreamContext from "@/providers/Stream";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useStreamContext = (): any => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};
