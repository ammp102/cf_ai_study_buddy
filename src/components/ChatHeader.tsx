import { Badge, Button, Text } from "@cloudflare/kumo";
import { ChatCircleDotsIcon, CircleIcon, TrashIcon } from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  connected: boolean;
  sessionTitle: string;
  onClear: () => void;
}

export function ChatHeader({ connected, sessionTitle, onClear }: Props) {
  return (
    <header className="px-5 py-4 bg-kumo-base border-b border-kumo-line">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-kumo-default">
            <span className="mr-2">📚</span>Study Buddy
          </h1>
          <Badge variant="secondary">
            <ChatCircleDotsIcon size={12} weight="bold" className="mr-1" />
            {sessionTitle}
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
          <ThemeToggle />
          <Button variant="secondary" icon={<TrashIcon size={16} />} onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </header>
  );
}
