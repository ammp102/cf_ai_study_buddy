import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo/components/toast";

import { SessionSidebar } from "./components/SessionSidebar";
import { StudySidebar } from "./components/StudySidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessageList } from "./components/MessageList";
import { ChatInput } from "./components/ChatInput";
import { useSessionTitle } from "./hooks/useSessionTitle";

function Chat() {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toasts = useKumoToastManager();

  const agentName = new URLSearchParams(window.location.search).get("session") || "default";
  const sessionTitle = useSessionTitle(agentName);

  const agent = useAgent({
    agent: "ChatAgent",
    name: agentName,
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback((error: Event) => console.error("WebSocket error:", error), []),
    onMessage: useCallback(
      (message: MessageEvent) => {
        try {
          const data = JSON.parse(String(message.data));
          if (data.type === "scheduled-task") {
            toasts.add({
              title: "Scheduled task completed",
              description: data.notificationMessage,
              timeout: 0,
            });
          }
          if (data.type === "quiz_created" || data.type === "flashcard_created") {
            setRefreshTrigger((n) => n + 1);
          }
        } catch {}
      },
      [toasts]
    ),
  });

  const { messages, sendMessage, clearHistory, addToolApprovalResponse, stop, status } =
    useAgentChat({
      agent,
    });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-refresh sidebar when a flashcard tool call completes
  const prevMessagesLen = useRef(0);
  useEffect(() => {
    if (messages.length !== prevMessagesLen.current) {
      prevMessagesLen.current = messages.length;
      const lastMsg = messages[messages.length - 1];
      const hasSaveFlashcard = lastMsg?.parts?.some(
        (p: any) =>
          p.type?.startsWith("tool") &&
          p.toolName === "saveFlashcard" &&
          p.state === "output-available"
      );
      if (hasSaveFlashcard) setRefreshTrigger((n) => n + 1);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus();
  }, [isStreaming]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, isStreaming, sendMessage]);

  const handleSuggestedPrompt = useCallback(
    (text: string) => sendMessage({ role: "user", parts: [{ type: "text", text }] }),
    [sendMessage]
  );

  return (
    <div className="flex h-screen bg-kumo-elevated overflow-hidden">
      <SessionSidebar currentSessionId={agentName} />

      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          connected={connected}
          sessionTitle={sessionTitle}
          onClear={clearHistory}
        />
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          messagesEndRef={messagesEndRef}
          addToolApprovalResponse={addToolApprovalResponse}
          onSuggestedPrompt={handleSuggestedPrompt}
        />
        <ChatInput
          input={input}
          setInput={setInput}
          connected={connected}
          isStreaming={isStreaming}
          textareaRef={textareaRef}
          onSend={send}
          onStop={stop}
        />
      </div>

      <StudySidebar agentName={agentName} refreshTrigger={refreshTrigger} />
    </div>
  );
}

export default function App() {
  return (
    <Toasty>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen text-kumo-inactive">
            Loading...
          </div>
        }
      >
        <Chat />
      </Suspense>
    </Toasty>
  );
}
