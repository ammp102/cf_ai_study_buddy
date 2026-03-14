import { useCallback, useEffect, useState } from "react";
import { Button, Text } from "@cloudflare/kumo";
import { ArrowsClockwiseIcon, PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import type { Session } from "../types";

interface Props {
  currentSessionId: string;
}

export function SessionSidebar({ currentSessionId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) return;

      const data = (await res.json()) as Session[];
      setSessions(data);

      const searchParams = new URLSearchParams(window.location.search);
      if (!searchParams.get("session")) {
        if (data.length > 0) {
          window.location.replace(`/?session=${data[0].id}`);
        } else {
          const createRes = await fetch("/api/sessions", { method: "POST" });
          if (createRes.ok) {
            const newSession = (await createRes.json()) as Session;
            window.location.replace(`/?session=${newSession.id}`);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createNewBuddy = async () => {
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      if (res.ok) {
        const newSession = (await res.json()) as Session;
        window.location.href = `/?session=${newSession.id}`;
      }
    } catch (e) {
      console.error("Failed to create session", e);
    }
  };

  const renameSession = async (id: string, currentTitle: string) => {
    const newTitle = window.prompt("Enter new session name:", currentTitle);
    if (!newTitle || newTitle.trim() === "" || newTitle === currentTitle) return;

    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        await fetchSessions();
        window.dispatchEvent(new Event("buddy-renamed"));
      }
    } catch (e) {
      console.error("Failed to rename session", e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-kumo-base border-r border-kumo-line w-64 shrink-0">
      <div className="px-4 py-4 border-b border-kumo-line">
        <Button
          variant="primary"
          className="w-full justify-center"
          icon={<PlusIcon size={16} />}
          onClick={createNewBuddy}
        >
          New Buddy
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-kumo-inactive">
            <ArrowsClockwiseIcon size={16} className="animate-spin mr-2" />
            <Text size="xs">Loading...</Text>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-4 text-kumo-subtle text-xs">
            No history yet.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between group px-2 py-1.5 rounded-lg text-sm transition-colors ${
                currentSessionId === session.id
                  ? "bg-kumo-elevated text-kumo-default font-semibold shadow-sm"
                  : "text-kumo-secondary hover:bg-kumo-elevated hover:text-kumo-default"
              }`}
            >
              <a href={`/?session=${session.id}`} className="truncate flex-1 px-1 py-1">
                {session.title}
              </a>
              <button
                onClick={() => renameSession(session.id, session.title)}
                className="opacity-0 group-hover:opacity-100 p-1.5 ml-1 rounded hover:bg-kumo-base text-kumo-inactive hover:text-kumo-default transition-all"
                title="Rename buddy"
              >
                <PencilSimpleIcon size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
