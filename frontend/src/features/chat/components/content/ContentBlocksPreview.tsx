import React, { useState } from "react";
import type { Base64ContentBlock } from "@langchain/core/messages";
import { MultimodalPreview } from "./MultimodalPreview";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Paperclip } from "lucide-react";

interface ContentBlocksPreviewProps {
  blocks: Base64ContentBlock[];
  onRemove: (idx: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Renders a preview of content blocks with optional remove functionality.
 * Collapsible when there are many blocks.
 */
export const ContentBlocksPreview: React.FC<ContentBlocksPreviewProps> = ({
  blocks,
  onRemove,
  size = "md",
  className,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!blocks.length) return null;

  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;

  return (
    <div className={cn("p-3.5 pb-0", className)}>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mb-1.5 flex items-center gap-1 text-xs"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronIcon className="h-3 w-3" />
        <Paperclip className="h-3 w-3" />
        <span>
          {blocks.length} file{blocks.length > 1 ? "s" : ""}
        </span>
      </button>
      {isOpen && (
        <div className="flex flex-wrap gap-2">
          {blocks.map((block, idx) => (
            <MultimodalPreview
              key={idx}
              block={block}
              removable
              onRemove={() => onRemove(idx)}
              size={size}
            />
          ))}
        </div>
      )}
    </div>
  );
};
