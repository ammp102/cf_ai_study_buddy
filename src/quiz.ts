import { DurableObject } from "cloudflare:workers";

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: string;
  createdAt: number;
}

export class QuizDO extends DurableObject {

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    // DELETE /quiz/:id
    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: cors });
      await this.deleteQuiz(id);
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // GET /quizzes — list all
    const quizzes = await this.getQuizzes();
    return new Response(JSON.stringify(quizzes), { headers: cors });
  }
  async getQuizzes(): Promise<Quiz[]> {
    const list = await this.ctx.storage.list<Quiz>({ prefix: "quiz:" });
    return Array.from(list.values());
  }

  async addQuiz(question: string, options: string[], answer: string): Promise<Quiz> {
    const id = crypto.randomUUID();
    const quiz: Quiz = { id, question, options, answer, createdAt: Date.now() };
    await this.ctx.storage.put(`quiz:${id}`, quiz);
    return quiz;
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.ctx.storage.delete(`quiz:${id}`);
  }
}