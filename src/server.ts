import { createWorkersAI } from "workers-ai-provider";
import { routeAgentRequest, callable, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  streamText,
  convertToModelMessages,
  pruneMessages,
  tool,
  stepCountIs
} from "ai";
import { z } from "zod";
export { FlashcardDO  } from "./flashcard";
export { QuizDO } from "./quiz";
//import { convertAsyncIteratorToReadableStream } from "ai/internal";

interface IState {
  name?: string
}

export class ChatAgent extends AIChatAgent<Env, IState> {
  // Wait for MCP connections to restore after hibernation before processing messages
  waitForMcpConnections = true;

  onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });

  }

  @callable()
  async addServer(name: string, url: string, host: string) {
    return await this.addMcpServer(name, url, { callbackHost: host });
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  getName() {
    return this.state?.name || this.name;
  }

  updateName() {
    if (!this.state?.name && this.name) {
      this.setState({ ...this.state, name: this.name });
    }
  }

  
  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });

    this.updateName()

    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system: `You are a study assistant. Your goal is to summarize content, generate quiz questions and flashcards, and set reminders to stop or start studying.
      IMPORTANT: only use tools if the user requests to schedule a message or handling quizes.

      ${getSchedulePrompt({ date: new Date() })}

      If the user asks to schedule a task, use the schedule tool to schedule the task.`,

      // Prune old tool calls to save tokens on long conversations
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: {
        // MCP tools from connected servers
        ...mcpTools,

        saveFlashcard: tool({
          description: "Save a term and definition as a flashcard for the user.",
          inputSchema: z.object({
            term: z.string().describe("The concept or word to remember"),
            definition: z.string().describe("The definition of the term")
          }),
          execute: async ({ term, definition }) => {
            // 1. Get a reference to the Durable Object namespace
            const id = this.env.FLASHCARD_DO.idFromName(this.name);
            const ns = this.env.FLASHCARD_DO.get(id);

            const flashcard = await ns.addFlashcard(term, definition);

            console.log(flashcard);
          
            return {
              success: true,
              message: `Flashcard for '${term}' saved successfully (ID: ${flashcard.id}).`
            };
          }
        }),

        


        scheduleTask: tool({
          description:
            "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") {
              return "Not a valid schedule input";
            }
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) return "Invalid schedule type";
            try {
              this.schedule(input, "executeTask", description);
              return `Task scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling task: ${error}`;
            }
          }
        }),

        getScheduledTasks: tool({
          description: "List all tasks that have been scheduled",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules();
            return tasks.length > 0 ? tasks : "No scheduled tasks found.";
          }
        }),

        cancelScheduledTask: tool({
          description: "Cancel a scheduled task by its ID",
          inputSchema: z.object({
            taskId: z.string().describe("The ID of the task to cancel")
          }),
          execute: async ({ taskId }) => {
            try {
              this.cancelSchedule(taskId);
              return `Task ${taskId} cancelled.`;
            } catch (error) {
              return `Error cancelling task: ${error}`;
            }
          }
        })
      },
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  async executeTask(description: string, _task: Schedule<string>) {
    // Do the actual work here (send email, call API, etc.)
    console.log(`Executing scheduled task: ${description}`);

    // Determine the custom message based on description keywords
  let notificationMessage: string;
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('break') || lowerDesc.includes('rest')) {
    notificationMessage = "It's time to take a break, maybe stretch your legs and drink some water? 🏆";
  } else if (lowerDesc.includes('study') || lowerDesc.includes('work') || lowerDesc.includes('learn')) {
    notificationMessage = "It's time to get working! I can help you if you have questions! 📚";
  } else {
    notificationMessage = `⏰ Reminder: ${description}`;
  }

  
  // Broadcast with custom message
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        notificationMessage,
        timestamp: new Date().toISOString()
      })
    );
  }



}



export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // ── Flashcard REST API ──────────────────────────────────────────────
    // Routes: GET /api/flashcards?agent=<name>
    //         DELETE /api/flashcards?agent=<name>&id=<cardId>
    if (url.pathname === "/api/flashcards") {
      const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      const agentName = url.searchParams.get("agent") ?? "default";
      const id = env.FLASHCARD_DO.idFromName(agentName);
      const stub = env.FLASHCARD_DO.get(id);

      if (request.method === "DELETE") {
        const cardId = url.searchParams.get("id");
        if (!cardId) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: cors });
        await stub.deleteFlashcard(cardId);
        return new Response(JSON.stringify({ success: true }), { headers: cors });
      }

      // GET — list all flashcards
      const flashcards = await stub.getFlashcards();
      return new Response(JSON.stringify(flashcards), { headers: cors });
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
