# CF_AI_STUDY_BUDDY

An AI-powered study assistant built on Cloudflare's edge infrastructure, developed as part of my Cloudflare internship application.

## What it does
Study Buddy helps students learn, memorize and plan their work through a conversational AI agent. Users can:

- Ask the agent to explain any topic
- Generate and save flashcards and quizzes that persist across sessions
- Schedule reminders to start or stop studying
- Maintain multiple independent sessions, each with their own conversation history, flashcards and quizzes

## Technical stack

- Cloudflare Workers — serverless backend and agent runtime
- Cloudflare Agents — stateful AI agent with WebSocket-based streaming
- Durable Objects — per-session flashcard and quiz storage (FlashcardDO, QuizDO)
- D1 — relational session management, allowing named and renameable conversations
- Workers AI — LLM inference via @cf/zai-org/glm-4.7-flash
- React — component-based frontend with real-time sidebar updates

## Setup

```bash
npm install
npx wrangler d1 execute study-buddy-db --local --file=schema.sql
npm run dev
``` 