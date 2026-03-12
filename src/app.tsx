import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import type { MCPServersState } from "agents";
import {
  Button,
  Badge,
  InputArea,
  Empty,
  Surface,
  Text
} from "@cloudflare/kumo";
import { Toasty, useKumoToastManager } from "@cloudflare/kumo/components/toast";
import { Streamdown } from "streamdown";
import { Switch } from "@cloudflare/kumo";
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  GearIcon,
  ChatCircleDotsIcon,
  CircleIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  BrainIcon,
  CaretDownIcon,
  BugIcon,
  PlugsConnectedIcon,
  PlusIcon,
  SignInIcon,
  XIcon,
  WrenchIcon,
  CardsIcon,
  ArrowsClockwiseIcon,
  ListChecksIcon
} from "@phosphor-icons/react";

// ── Small components ──────────────────────────────────────────────────

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-mode") === "dark"
  );

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    const mode = next ? "dark" : "light";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme", mode);
  }, [dark]);

  return (
    <Button
      variant="secondary"
      shape="square"
      icon={dark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      onClick={toggle}
      aria-label="Toggle theme"
    />
  );
}

// ── Tool rendering ────────────────────────────────────────────────────

function ToolPartView({
  part,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);

  // Completed
  if (part.state === "output-available") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2 mb-1">
            <GearIcon size={14} className="text-kumo-inactive" />
            <Text size="xs" variant="secondary" bold>
              {toolName}
            </Text>
            <Badge variant="secondary">Done</Badge>
          </div>
          <div className="font-mono">
            <Text size="xs" variant="secondary">
              {JSON.stringify(part.output, null, 2)}
            </Text>
          </div>
        </Surface>
      </div>
    );
  }

  // Needs approval
  if ("approval" in part && part.state === "approval-requested") {
    const approvalId = (part.approval as { id?: string })?.id;
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-3 rounded-xl ring-2 ring-kumo-warning">
          <div className="flex items-center gap-2 mb-2">
            <GearIcon size={14} className="text-kumo-warning" />
            <Text size="sm" bold>
              Approval needed: {toolName}
            </Text>
          </div>
          <div className="font-mono mb-3">
            <Text size="xs" variant="secondary">
              {JSON.stringify(part.input, null, 2)}
            </Text>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: true });
                }
              }}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: false });
                }
              }}
            >
              Reject
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  // Rejected / denied
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2">
            <XCircleIcon size={14} className="text-kumo-danger" />
            <Text size="xs" variant="secondary" bold>
              {toolName}
            </Text>
            <Badge variant="secondary">Rejected</Badge>
          </div>
        </Surface>
      </div>
    );
  }

  // Executing
  if (part.state === "input-available" || part.state === "input-streaming") {
    return (
      <div className="flex justify-start">
        <Surface className="max-w-[85%] px-4 py-2.5 rounded-xl ring ring-kumo-line">
          <div className="flex items-center gap-2">
            <GearIcon size={14} className="text-kumo-inactive animate-spin" />
            <Text size="xs" variant="secondary">
              Running {toolName}...
            </Text>
          </div>
        </Surface>
      </div>
    );
  }

  return null;
}

// ── Flashcard types ───────────────────────────────────────────────────

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  createdAt: number;
}

// ── Quize types ───────────────────────────────────────────────────

interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: string;
  createdAt: number;
}

// ── Study Sidebar ─────────────────────────────────────────────────────

function StudySidebar({
  agentName,
  refreshTrigger
}: {
  agentName: string;
  refreshTrigger: number;
}) {
  const [activeTab, setActiveTab] = useState<"flashcards" | "quiz">("flashcards");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const fetchFlashcards = useCallback(async () => {
    if (!agentName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/flashcards?agent=${encodeURIComponent(agentName)}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text) as Flashcard[];
          setFlashcards(data);
        } catch {
          console.error("Failed to parse flashcards JSON:", text.slice(0, 200));
        }
      } else {
        console.error("Flashcards fetch failed:", res.status, await res.text());
      }
    } catch (e) {
      console.error("Failed to fetch flashcards", e);
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  const fetchQuizzes = useCallback(async () => {
    if (!agentName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quizzes?agent=${encodeURIComponent(agentName)}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text) as Quiz[];
          setQuizzes(data);
        } catch {
          console.error("Failed to parse quizzes JSON:", text.slice(0, 200));
        }
      } else {
        console.error("Quizzes fetch failed:", res.status, await res.text());
      }
    } catch (e) {
      console.error("Failed to fetch quizzes", e);
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  useEffect(() => {
    fetchFlashcards();
    fetchQuizzes();
  }, [fetchFlashcards, fetchQuizzes, refreshTrigger]);

  const deleteFlashcard = async (id: string) => {
    try {
      await fetch(`/api/flashcards?agent=${encodeURIComponent(agentName)}&id=${id}`, {
        method: "DELETE"
      });
      setFlashcards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Failed to delete flashcard", e);
    }
  };

  const deleteQuiz = async (id: string) => {
    try {
      await fetch(`/api/quizzes?agent=${encodeURIComponent(agentName)}&id=${id}`, {
        method: "DELETE"
      });
      setQuizzes((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Failed to delete quiz", e);
    }
  };

  const toggleFlip = (id: string) => {
    setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col h-full bg-kumo-base border-l border-kumo-line w-80 shrink-0">
      {/* Sidebar header */}
      <div className="px-4 py-3 border-b border-kumo-line">
        <div className="flex items-center justify-between mb-3">
          <Text size="sm" bold>Study Materials</Text>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            icon={<ArrowsClockwiseIcon size={14} className={loading ? "animate-spin" : ""} />}
            onClick={() => {
              fetchFlashcards();
              fetchQuizzes();
            }}
            aria-label="Refresh"
          />
        </div>
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-kumo-elevated">
          <button
            onClick={() => setActiveTab("flashcards")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === "flashcards"
                ? "bg-kumo-base text-kumo-default shadow-sm"
                : "text-kumo-inactive hover:text-kumo-subtle"
            }`}
          >
            <CardsIcon size={13} />
            Cards
            {flashcards.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-kumo-brand/10 text-kumo-brand text-[10px] leading-none font-semibold">
                {flashcards.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === "quiz"
                ? "bg-kumo-base text-kumo-default shadow-sm"
                : "text-kumo-inactive hover:text-kumo-subtle"
            }`}
          >
            <ListChecksIcon size={13} />
            Quiz
            {quizzes.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-kumo-brand/10 text-kumo-brand text-[10px] leading-none font-semibold">
                {quizzes.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "flashcards" && (
          <div className="p-3 space-y-2">
            {loading && flashcards.length === 0 && (
              <div className="flex items-center justify-center py-8 text-kumo-inactive">
                <ArrowsClockwiseIcon size={16} className="animate-spin mr-2" />
                <Text size="xs" variant="secondary">Loading...</Text>
              </div>
            )}
            {!loading && flashcards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                <CardsIcon size={28} className="text-kumo-inactive" />
                <Text size="xs" variant="secondary">
                  No flashcards yet. Ask the assistant to save a term as a flashcard!
                </Text>
              </div>
            )}
            {flashcards.map((card) => (
              <div
                key={card.id}
                className="group relative rounded-xl border border-kumo-line bg-kumo-base overflow-hidden cursor-pointer hover:border-kumo-accent transition-colors"
                onClick={() => toggleFlip(card.id)}
              >
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-kumo-elevated text-kumo-inactive hover:text-kumo-danger z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFlashcard(card.id);
                  }}
                  aria-label="Delete flashcard"
                >
                  <TrashIcon size={12} />
                </button>

                <div className="px-3 py-2.5">
                  {!flipped[card.id] ? (
                    <>
                      <span className="block text-xs text-kumo-subtle uppercase tracking-wide font-semibold mb-1">Term</span>
                      <Text size="sm" bold>{card.term}</Text>
                      <span className="block text-xs text-kumo-subtle mt-1.5">Tap to reveal definition</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-xs text-kumo-subtle uppercase tracking-wide font-semibold mb-1">Definition</span>
                      <Text size="sm">{card.definition}</Text>
                      <span className="block text-xs text-kumo-brand mt-1.5">{card.term}</span>
                    </>
                  )}
                </div>

                <div className={`h-0.5 w-full transition-colors ${flipped[card.id] ? "bg-kumo-success" : "bg-kumo-brand/30"}`} />
              </div>
            ))}
          </div>
        )}

        {activeTab === "quiz" && (
          <div className="p-3 space-y-2">
            {loading && quizzes.length === 0 && (
              <div className="flex items-center justify-center py-8 text-kumo-inactive">
                <ArrowsClockwiseIcon size={16} className="animate-spin mr-2" />
                <Text size="xs" variant="secondary">Loading...</Text>
              </div>
            )}
            {!loading && quizzes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                <CardsIcon size={28} className="text-kumo-inactive" />
                <Text size="xs" variant="secondary">
                  No quizzes yet. Ask the assistant to generate questions!
                </Text>
              </div>
            )}
            {quizzes.map((card) => (
              <div
                key={card.id}
                className="group relative rounded-xl border border-kumo-line bg-kumo-base overflow-hidden cursor-pointer hover:border-kumo-accent transition-colors"
                onClick={() => toggleFlip(card.id)}
              >
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-kumo-elevated text-kumo-inactive hover:text-kumo-danger z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteQuiz(card.id);
                  }}
                  aria-label="Delete quiz"
                >
                  <TrashIcon size={12} />
                </button>

                <div className="px-3 py-2.5">
                  {!flipped[card.id] ? (
                    <>
                      <span className="block text-xs text-kumo-subtle uppercase tracking-wide font-semibold mb-1">Question</span>
                      <Text size="sm" bold>{card.question}</Text>
                      
                      <span className="block text-xs text-kumo-subtle uppercase tracking-wide font-semibold mt-3 mb-1">Options</span>
                      <div className="flex flex-col gap-1 mb-2">
                        {card.options.map((option, idx) => (
                            <Text key={idx} size="sm">• {option}</Text>
                        ))}
                      </div>
                      <span className="block text-xs text-kumo-subtle mt-1.5">Tap to reveal the answer</span>
                    </>
                  ) : (
                    <>
                      <span className="block text-xs text-kumo-subtle uppercase tracking-wide font-semibold mb-1">Question</span>
                      <Text size="sm" bold>{card.question}</Text>
                      <span className="block text-xs text-kumo-subtle uppercase tracking-wide font-semibold mt-3 mb-1">Answer</span>
                      <Text size="sm">{card.answer}</Text>
                    </>
                  )}
                </div>

                <div className={`h-0.5 w-full transition-colors ${flipped[card.id] ? "bg-kumo-success" : "bg-kumo-brand/30"}`} />
              </div>
            ))}
          </div>
        )}
        
      </div>
    </div>
  );
}

// ── Main chat ─────────────────────────────────────────────────────────

function Chat() {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toasts = useKumoToastManager();
  const [mcpState, setMcpState] = useState<MCPServersState>({
    prompts: [],
    resources: [],
    servers: {},
    tools: []
  });
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [isAddingServer, setIsAddingServer] = useState(false);
  const mcpPanelRef = useRef<HTMLDivElement>(null);
  const [flashcardRefreshTrigger, setFlashcardRefreshTrigger] = useState(0);

  // Derive a stable agent name from the URL path (matches AIChatAgent routing)
  const agentName = (() => {
    const parts = window.location.pathname.split("/");
    // e.g. /agents/ChatAgent/<name> -> last segment
    const idx = parts.indexOf("agents");
    return idx >= 0 && parts[idx + 2] ? parts[idx + 2] : "default";
  })();

  const agent = useAgent({
    agent: "ChatAgent",
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback(
      (error: Event) => console.error("WebSocket error:", error),
      []
    ),
    onMcpUpdate: useCallback((state: MCPServersState) => {
      setMcpState(state);
    }, []),
    onMessage: useCallback(
      (message: MessageEvent) => {
        try {
          const data = JSON.parse(String(message.data));
          if (data.type === "scheduled-task") {
            toasts.add({
              title: "Scheduled task completed",
              description: data.notificationMessage,
              timeout: 0
            });
          }
        } catch {
        }
      },
      [toasts]
    )
  });

  // Close MCP panel when clicking outside
  useEffect(() => {
    if (!showMcpPanel) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        mcpPanelRef.current &&
        !mcpPanelRef.current.contains(e.target as Node)
      ) {
        setShowMcpPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMcpPanel]);

  const handleAddServer = async () => {
    if (!mcpName.trim() || !mcpUrl.trim()) return;
    setIsAddingServer(true);
    try {
      await agent.call("addServer", [
        mcpName.trim(),
        mcpUrl.trim(),
        window.location.origin
      ]);
      setMcpName("");
      setMcpUrl("");
    } catch (e) {
      console.error("Failed to add MCP server:", e);
    } finally {
      setIsAddingServer(false);
    }
  };

  const handleRemoveServer = async (serverId: string) => {
    try {
      await agent.call("removeServer", [serverId]);
    } catch (e) {
      console.error("Failed to remove MCP server:", e);
    }
  };

  const serverEntries = Object.entries(mcpState.servers);
  const mcpToolCount = mcpState.tools.length;

  const {
    messages,
    sendMessage,
    clearHistory,
    addToolApprovalResponse,
    stop,
    status
  } = useAgentChat({
    agent,
    onToolCall: async (event) => {
      if (
        "addToolOutput" in event &&
        event.toolCall.toolName === "getUserTimezone"
      ) {
        event.addToolOutput({
          toolCallId: event.toolCall.toolCallId,
          output: {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            localTime: new Date().toLocaleTimeString()
          }
        });
      }
    }
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-refresh sidebar when a flashcard is saved
  const prevMessagesLen = useRef(0);
  useEffect(() => {
    if (messages.length !== prevMessagesLen.current) {
      prevMessagesLen.current = messages.length;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        const hasSaveFlashcard = lastMsg.parts?.some(
          (p: any) =>
            p.type?.startsWith("tool") &&
            p.toolName === "saveFlashcard" &&
            p.state === "output-available"
        );
        if (hasSaveFlashcard) {
          setFlashcardRefreshTrigger((n) => n + 1);
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Re-focus the input after streaming ends
  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sendMessage]);

  return (
    <div className="flex h-screen bg-kumo-elevated overflow-hidden">
      {/* Chat column */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <header className="px-5 py-4 bg-kumo-base border-b border-kumo-line">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-kumo-default">
              <span className="mr-2">📚</span>Study Buddy
            </h1>
            <Badge variant="secondary">
              <ChatCircleDotsIcon size={12} weight="bold" className="mr-1" />
              Study buddy
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <CircleIcon
                size={8}
                weight="fill"
                className={connected ? "text-kumo-success" : "text-kumo-danger"}
              />
              <Text size="xs" variant="secondary">
                {connected ? "Connected" : "Disconnected"}
              </Text>
            </div>

            {
              /* Debug mode
            //<div className="flex items-center gap-1.5">
            //  <BugIcon size={14} className="text-kumo-inactive" />
            //  <Switch
            //    checked={showDebug}
            //    onCheckedChange={setShowDebug}
            //    size="sm"
            //    aria-label="Toggle debug mode"
            //  />
            //</div> */
            }
            <ThemeToggle />

            <Button
              variant="secondary"
              icon={<TrashIcon size={16} />}
              onClick={clearHistory}
            >
              Clear
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
          {messages.length === 0 && (
            <Empty
              icon={<ChatCircleDotsIcon size={32} />}
              title="Start a conversation"
              contents={
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Summarize the process of photosynthesis.",
                    "Generate 5 flashcards on symmetric cryptography.",
                    "Generate a 3-question quiz on World War II.",
                    "Remind me to study math in 30 minutes."
                  ].map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      disabled={isStreaming}
                      onClick={() => {
                        sendMessage({
                          role: "user",
                          parts: [{ type: "text", text: prompt }]
                        });
                      }}
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
                {showDebug && (
                  <pre className="text-[11px] text-kumo-subtle bg-kumo-control rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(message, null, 2)}
                  </pre>
                )}

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
                            <span className="font-medium text-kumo-default">
                              Reasoning
                            </span>
                            {isDone ? (
                              <span className="text-xs text-kumo-success">
                                Complete
                              </span>
                            ) : (
                              <span className="text-xs text-kumo-brand">
                                Thinking...
                              </span>
                            )}
                            <CaretDownIcon
                              size={14}
                              className="ml-auto text-kumo-inactive"
                            />
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

      {/* Input */}
      <div className="border-t border-kumo-line bg-kumo-base">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
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
                  send();
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
                onClick={stop}
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
      </div>
      {/* Study sidebar */}
      <StudySidebar agentName={agentName} refreshTrigger={flashcardRefreshTrigger} />
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
