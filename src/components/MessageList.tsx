import type {RefObject} from "react";
import { isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { Button, Empty } from "@cloudflare/kumo";
import { BrainIcon, CaretDownIcon, ChatCircleDotsIcon } from "@phosphor-icons/react";
import { Streamdown } from "streamdown";
import { ToolPartView } from "./ToolPartView";

const SUGGESTED_PROMPTS = [
  "Summarize the process of photosynthesis.",
  "Generate 5 flashcards on symmetric cryptography.",
  "Generate a 3-question quiz on World War II.",
  "Remind me to study math in 30 minutes.",
];

interface Props {
  messages: UIMessage[];
  isStreaming: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
  onSuggestedPrompt: (text: string) => void;
}

export function MessageList({
  messages,
  isStreaming,
  messagesEndRef,
  addToolApprovalResponse,
  onSuggestedPrompt,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        {messages.length === 0 && (
          <Empty
            icon={<ChatCircleDotsIcon size={32} />}
            title="Start a conversation"
            contents={
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    disabled={isStreaming}
                    onClick={() => onSuggestedPrompt(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            }
          />
        )}

        {messages.map((message: UIMessage, index: number) => {
          const isUser = message.role === "user";
          const isLastAssistant =
            message.role === "assistant" && index === messages.length - 1;

          return (
            <div key={message.id} className="space-y-2">
              {/* Tool parts */}
              {message.parts.filter(isToolUIPart).map((part) => (
                <ToolPartView
                  key={part.toolCallId}
                  part={part}
                  addToolApprovalResponse={addToolApprovalResponse}
                />
              ))}

              {/* Reasoning parts */}
              {message.parts
                .filter(
                  (part) =>
                    part.type === "reasoning" &&
                    (part as { text?: string }).text?.trim()
                )
                .map((part, i) => {
                  const reasoning = part as {
                    type: "reasoning";
                    text: string;
                    state?: "streaming" | "done";
                  };
                  const isDone = reasoning.state === "done" || !isStreaming;
                  return (
                    <div key={i} className="flex justify-start">
                      <details className="max-w-[85%] w-full" open={!isDone}>
                        <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm select-none">
                          <BrainIcon size={14} className="text-purple-400" />
                          <span className="font-medium text-kumo-default">Reasoning</span>
                          {isDone ? (
                            <span className="text-xs text-kumo-success">Complete</span>
                          ) : (
                            <span className="text-xs text-kumo-brand">Thinking...</span>
                          )}
                          <CaretDownIcon size={14} className="ml-auto text-kumo-inactive" />
                        </summary>
                        <pre className="mt-2 px-3 py-2 rounded-lg bg-kumo-control text-xs text-kumo-default whitespace-pre-wrap overflow-auto max-h-64">
                          {reasoning.text}
                        </pre>
                      </details>
                    </div>
                  );
                })}

              {/* Text parts */}
              {message.parts
                .filter((part) => part.type === "text")
                .map((part, i) => {
                  const text = (part as { type: "text"; text: string }).text;
                  if (!text) return null;

                  if (isUser) {
                    return (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-kumo-contrast text-kumo-inverse leading-relaxed">
                          {text}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={i} className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-kumo-base text-kumo-default leading-relaxed">
                        <Streamdown
                          className="sd-theme rounded-2xl rounded-bl-md p-3"
                          controls={false}
                          isAnimating={isLastAssistant && isStreaming}
                        >
                          {text}
                        </Streamdown>
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
