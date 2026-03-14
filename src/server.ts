import { createWorkersAI } from "workers-ai-provider";
import { routeAgentRequest, type Schedule } from "agents";
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

  updateName() {
    if (!this.state?.name && this.name) {
      this.setState({ ...this.state, name: this.name });
    }
  }

  
  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI });

    this.updateName()

    const result = streamText({
      model: workersai("@cf/zai-org/glm-4.7-flash"),
      system: `You are a study assistant. Your goal is to summarize content, generate quiz questions and flashcards, and set reminders to stop or start studying.
      IMPORTANT: only use tools if the user requests to schedule a message, create a quiz or create a flashcard.
      IMPORTANT: If the user asks to generate flashcards from quizzes DO NOT generate quizzes again, simply use the question and correct answer.
      IMPORTANT: If the user asks to generate quizzes from flashcards DO NOT generate flashcards again, simply use the term and definition and generate 3 more options.

      ${getSchedulePrompt({ date: new Date() })}

      If the user asks to schedule a task, use the schedule tool to schedule the task.`,

      // Prune old tool calls to save tokens on long conversations
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: {

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

            //console.log(flashcard);
            this.broadcast(JSON.stringify({type: "flashcard_created"}));
          
            return {
              success: true,
              message: `Flashcard for '${term}' saved successfully (ID: ${flashcard.id}).`
            };
          }
        }),

        saveQuiz: tool({
          description: "Save a question, the options and the answer for the user.",
          inputSchema: z.object({
            question: z.string().describe("The question to answer"),
            options: z.string().array().describe("The options for the question. IMPORTANT: This MUST be a valid JSON array of strings, for example: ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4']\")"),
            answer: z.string().describe("The answer to the questions")
          }),
          execute: async ({ question, options, answer }) => {
            // 1. Get a reference to the Durable Object namespace
            const id = this.env.QUIZ_DO.idFromName(this.name);
            const ns = this.env.QUIZ_DO.get(id);

            const quiz = await ns.addQuiz(question, options, answer);

            //console.log(quiz);
            this.broadcast(JSON.stringify({type: "quiz_created"}));
          
            return {
              success: true,
              message: `Quiz for '${question}' saved successfully (ID: ${quiz.id}).`
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
    console.log(`Executing scheduled task: ${description}`);

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

      const flashcards = await stub.getFlashcards();
      return new Response(JSON.stringify(flashcards), { headers: cors });
    }

    if (url.pathname === "/api/quizzes") {
      const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      const agentName = url.searchParams.get("agent") ?? "default";
      const id = env.QUIZ_DO.idFromName(agentName);
      const stub = env.QUIZ_DO.get(id);

      if (request.method === "DELETE") {
        const cardId = url.searchParams.get("id");
        if (!cardId) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: cors });
        await stub.deleteQuiz(cardId);
        return new Response(JSON.stringify({ success: true }), { headers: cors });
      }

      const quizzes = await stub.getQuizzes();
      return new Response(JSON.stringify(quizzes), { headers: cors });
    }

    if (url.pathname === "/api/sessions") {
      const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

      // GET — List all sessions (newest first)
      if (request.method === "GET") {
        const { results } = await env.DB.prepare(
            "SELECT * FROM sessions ORDER BY created_at DESC"
        ).all();
        return new Response(JSON.stringify(results), { headers: cors });
      }

      if (request.method === "POST") {
        const id = crypto.randomUUID(); // This is the immutable ID for the DOs
        const title = "New Buddy";
        const createdAt = Date.now();

        await env.DB.prepare(
            "INSERT INTO sessions (id, title, created_at) VALUES (?, ?, ?)"
        ).bind(id, title, createdAt).run();

        return new Response(JSON.stringify({ id, title, created_at: createdAt }), {
          status: 201,
          headers: cors
        });
      }
    }

    if (url.pathname.startsWith("/api/sessions/")) {
      const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
      const id = url.pathname.split("/").pop();

      if (!id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers: cors });

      if (request.method === "PATCH") {
        const body = await request.json() as { title: string };
        if (!body.title) {
          return new Response(JSON.stringify({ error: "Missing title" }), { status: 400, headers: cors });
        }

        await env.DB.prepare(
            "UPDATE sessions SET title = ? WHERE id = ?"
        ).bind(body.title, id).run();

        return new Response(JSON.stringify({ success: true }), { headers: cors });
      }
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );


  }
} satisfies ExportedHandler<Env>;
