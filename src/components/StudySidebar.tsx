import React, { useCallback, useEffect, useState } from "react";
import { Button, Text } from "@cloudflare/kumo";
import {
  ArrowsClockwiseIcon,
  CardsIcon,
  ListChecksIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { Flashcard, Quiz } from "../types";

interface Props {
  agentName: string;
  refreshTrigger: number;
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
        active
          ? "bg-kumo-base text-kumo-default shadow-sm"
          : "text-kumo-inactive hover:text-kumo-subtle"
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-kumo-brand/10 text-kumo-brand text-[10px] leading-none font-semibold">
          {count}
        </span>
      )}
    </button>
  );
}

function FlashcardItem({
  card,
  flipped,
  onFlip,
  onDelete,
}: {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group relative rounded-xl border border-kumo-line bg-kumo-base overflow-hidden cursor-pointer hover:border-kumo-accent transition-colors"
      onClick={onFlip}
    >
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-kumo-elevated text-kumo-inactive hover:text-kumo-danger z-10"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete flashcard"
      >
        <TrashIcon size={12} />
      </button>
      <div className="px-3 py-2.5">
        {!flipped ? (
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
      <div className={`h-0.5 w-full transition-colors ${flipped ? "bg-kumo-success" : "bg-kumo-brand/30"}`} />
    </div>
  );
}

function QuizItem({
  card,
  flipped,
  onFlip,
  onDelete,
}: {
  card: Quiz;
  flipped: boolean;
  onFlip: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group relative rounded-xl border border-kumo-line bg-kumo-base overflow-hidden cursor-pointer hover:border-kumo-accent transition-colors"
      onClick={onFlip}
    >
      <button
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-kumo-elevated text-kumo-inactive hover:text-kumo-danger z-10"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete quiz"
      >
        <TrashIcon size={12} />
      </button>
      <div className="px-3 py-2.5">
        {!flipped ? (
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
      <div className={`h-0.5 w-full transition-colors ${flipped ? "bg-kumo-success" : "bg-kumo-brand/30"}`} />
    </div>
  );
}

export function StudySidebar({ agentName, refreshTrigger }: Props) {
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
        const data = JSON.parse(await res.text()) as Flashcard[];
        setFlashcards(data);
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
        const data = JSON.parse(await res.text()) as Quiz[];
        setQuizzes(data);
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
      await fetch(`/api/flashcards?agent=${encodeURIComponent(agentName)}&id=${id}`, { method: "DELETE" });
      setFlashcards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Failed to delete flashcard", e);
    }
  };

  const deleteQuiz = async (id: string) => {
    try {
      await fetch(`/api/quizzes?agent=${encodeURIComponent(agentName)}&id=${id}`, { method: "DELETE" });
      setQuizzes((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Failed to delete quiz", e);
    }
  };

  const toggleFlip = (id: string) =>
    setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));

  const refreshAll = () => { fetchFlashcards(); fetchQuizzes(); };

  return (
    <div className="flex flex-col h-full bg-kumo-base border-l border-kumo-line w-80 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-kumo-line">
        <div className="flex items-center justify-between mb-3">
          <Text size="sm" bold>Study Materials</Text>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            icon={<ArrowsClockwiseIcon size={14} className={loading ? "animate-spin" : ""} />}
            onClick={refreshAll}
            aria-label="Refresh"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-kumo-elevated">
          <TabButton
            active={activeTab === "flashcards"}
            onClick={() => setActiveTab("flashcards")}
            icon={<CardsIcon size={13} />}
            label="Cards"
            count={flashcards.length}
          />
          <TabButton
            active={activeTab === "quiz"}
            onClick={() => setActiveTab("quiz")}
            icon={<ListChecksIcon size={13} />}
            label="Quiz"
            count={quizzes.length}
          />
        </div>
      </div>

      {/* Content */}
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
              <FlashcardItem
                key={card.id}
                card={card}
                flipped={flipped[card.id]}
                onFlip={() => toggleFlip(card.id)}
                onDelete={() => deleteFlashcard(card.id)}
              />
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
              <QuizItem
                key={card.id}
                card={card}
                flipped={flipped[card.id]}
                onFlip={() => toggleFlip(card.id)}
                onDelete={() => deleteQuiz(card.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
