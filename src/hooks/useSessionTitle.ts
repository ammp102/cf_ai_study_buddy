import { useEffect, useState } from "react";
import type { Session } from "../types";

export function useSessionTitle(agentName: string) {
  const [sessionTitle, setSessionTitle] = useState("New Buddy");

  useEffect(() => {
    if (!agentName || agentName === "default") return;

    const fetchCurrentTitle = async () => {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok) {
          const sessions = (await res.json()) as Session[];
          const current = sessions.find((s) => s.id === agentName);
          if (current) setSessionTitle(current.title);
        }
      } catch (e) {
        console.error("Failed to load session title", e);
      }
    };

    fetchCurrentTitle();
    window.addEventListener("buddy-renamed", fetchCurrentTitle);
    return () => window.removeEventListener("buddy-renamed", fetchCurrentTitle);
  }, [agentName]);

  return sessionTitle;
}
