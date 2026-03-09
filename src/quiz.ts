import { DurableObject } from "cloudflare:workers";

export interface Quiz {
  id: string;
  term: string;
  options: string[];
  correct: string;
  createdAt: number;
}

export class QuizDO extends DurableObject {
  async getQuizzes(): Promise<Quiz[]> {
    const list = await this.ctx.storage.list<Quiz>({ prefix: "Quiz:" });
    return Array.from(list.values());
  }

  async addQuiz(term: string, options: string[], correct: string): Promise<Quiz> {
    const id = crypto.randomUUID();
    const quiz: Quiz = { id, term, options, correct, createdAt: Date.now() };
    await this.ctx.storage.put(`quiz:${id}`, quiz);
    return quiz;
  }

  async deleteQuiz(id: string): Promise<void> {
    await this.ctx.storage.delete(`quiz:${id}`);
  }
}