import type {RefObject} from "react";
import { Button, InputArea } from "@cloudflare/kumo";
import { PaperPlaneRightIcon, StopIcon } from "@phosphor-icons/react";

interface Props {
  input: string;
  setInput: (value: string) => void;
  connected: boolean;
  isStreaming: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onSend: () => void;
  onStop: () => void;
}

export function ChatInput({
  input,
  setInput,
  connected,
  isStreaming,
  textareaRef,
  onSend,
  onStop,
}: Props) {
  return (
    <div className="border-t border-kumo-line bg-kumo-base">
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="max-w-3xl mx-auto px-5 py-4"
      >
        <div className="flex items-end gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-sm focus-within:ring-2 focus-within:ring-kumo-ring focus-within:border-transparent transition-shadow">
          <InputArea
            ref={textareaRef}
            value={input}
            onValueChange={setInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            placeholder="Send a message..."
            disabled={!connected || isStreaming}
            rows={1}
            className="flex-1 ring-0! focus:ring-0! shadow-none! bg-transparent! outline-none! resize-none max-h-40"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="secondary"
              shape="square"
              aria-label="Stop generation"
              icon={<StopIcon size={18} />}
              onClick={onStop}
              className="mb-0.5"
            />
          ) : (
            <Button
              type="submit"
              variant="primary"
              shape="square"
              aria-label="Send message"
              disabled={!input.trim() || !connected}
              icon={<PaperPlaneRightIcon size={18} />}
              className="mb-0.5"
            />
          )}
        </div>
      </form>
    </div>
  );
}
