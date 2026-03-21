import { useStreamContext } from "@/features/chat/hooks/useStreamContext";
import { Message } from "@langchain/langgraph-sdk";
import { useState, useRef, memo } from "react";
import { getContentString } from "../utils";
import { cn } from "@/lib/utils";
import { STREAM_OPTIONS } from "@/lib/constants";
import { Textarea } from "@/shared/components/ui/textarea";
import { BranchSwitcher, CommandBar } from "./shared";
import { MultimodalPreview } from "@/features/chat/components/content/MultimodalPreview";
import { isBase64ContentBlock } from "@/lib/utils/multimodal";
import { MarkdownText } from "../content/MarkdownText";
import { TruncatedFileName } from "../schema-ui/fields/TruncatedFileName";
import { FileText } from "lucide-react";

function EditableContent({
  value,
  setValue,
  onSubmit,
}: {
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className="focus-visible:ring-0"
    />
  );
}

export const HumanMessage = memo(function HumanMessage({
  message,
  isLoading,
}: {
  message: Message;
  isLoading: boolean;
}) {
  const thread = useStreamContext();
  const meta = thread.getMessagesMetadata(message);
  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

  const mountTime = useRef(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const contentString = getContentString(message.content);
  const isAgentGenerated = !!message.name && message.name.length > 0;

  const handleSubmitEdit = () => {
    setIsEditing(false);

    const newMessage: Message = { type: "human", content: value };
    thread.submit(
      { messages: [newMessage] },
      {
        checkpoint: parentCheckpoint,
        ...STREAM_OPTIONS,
        optimisticValues: (prev) => {
          const values = meta?.firstSeenState?.values;
          if (!values) return prev;

          return {
            ...values,
            messages: [...(values.messages ?? []), newMessage],
          };
        },
      },
    );
  };

  // Agent-generated human messages (e.g. from reflection critic) render differently
  if (isAgentGenerated) {
    return (
      <div className="group mr-auto flex items-start gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground mb-2 text-sm font-semibold">
            {message.name}
          </span>
          <div className="min-w-0 overflow-hidden py-1 leading-relaxed">
            <MarkdownText>{contentString}</MarkdownText>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group ml-auto flex items-center gap-2",
        isEditing && "w-full max-w-xl",
      )}
    >
      <div className={cn("flex flex-col gap-2", isEditing && "w-full")}>
        {isEditing ? (
          <EditableContent
            value={value}
            setValue={setValue}
            onSubmit={handleSubmitEdit}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* Render images and file names */}
            {Array.isArray(message.content) && message.content.length > 0 && (() => {
              const images: React.ReactNode[] = [];
              const files: { name: string; idx: number }[] = [];
              message.content.forEach((block, idx) => {
                if (!isBase64ContentBlock(block)) return;
                const b = block as { type: string; mime_type?: string; metadata?: Record<string, string> };
                if (b.type === "image") {
                  images.push(<MultimodalPreview key={idx} block={block} size="md" />);
                } else {
                  const name = b.metadata?.filename || b.metadata?.name || `file-${idx + 1}`;
                  files.push({ name, idx });
                }
              });
              return (
                <>
                  {images.length > 0 && (
                    <div className="flex flex-wrap items-start justify-end gap-2">{images}</div>
                  )}
                  {files.length > 0 && (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {files.map((f) => (
                        <span key={f.idx} className="bg-muted/60 border-border/30 inline-flex max-w-[200px] items-center gap-1 rounded-lg border px-2 py-1 text-xs">
                          <FileText className="text-muted-foreground h-3 w-3 flex-shrink-0" />
                          <TruncatedFileName name={f.name} className="text-muted-foreground" />
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            {/* Render text if present, otherwise fallback to file/image name */}
            {contentString ? (
              <p className="bg-muted border-border/30 w-fit max-w-2xl rounded-3xl border px-5 py-3 text-left whitespace-pre-wrap shadow-sm transition-all duration-200 hover:shadow-md">
                {contentString}
              </p>
            ) : null}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground/40 text-sm font-medium tabular-nums">
            {mountTime.current.toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}{" "}
            {mountTime.current.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <BranchSwitcher
            branch={meta?.branch}
            branchOptions={meta?.branchOptions}
            onSelect={(branch) => thread.setBranch(branch)}
            isLoading={isLoading}
          />
          <CommandBar
            isLoading={isLoading}
            content={contentString}
            isEditing={isEditing}
            setIsEditing={(c) => {
              if (c) {
                setValue(contentString);
              }
              setIsEditing(c);
            }}
            handleSubmitEdit={handleSubmitEdit}
            isHumanMessage={true}
          />
        </div>
      </div>
    </div>
  );
});
