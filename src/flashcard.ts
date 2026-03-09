import { DurableObject } from "cloudflare:workers";

export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  createdAt: number;
}

export class FlashcardDO extends DurableObject {
  async getFlashcards(): Promise<Flashcard[]> {
    const list = await this.ctx.storage.list<Flashcard>({ prefix: "flashcard:" });
    return Array.from(list.values());
  }

  async addFlashcard(term: string, definition: string): Promise<Flashcard> {
    const id = crypto.randomUUID();
    const flashcard: Flashcard = { id, term, definition, createdAt: Date.now() };
    await this.ctx.storage.put(`flashcard:${id}`, flashcard);
    return flashcard;
  }

  async deleteFlashcard(id: string): Promise<void> {
    await this.ctx.storage.delete(`flashcard:${id}`);
  }
}