import { DurableObject } from "cloudflare:workers";

export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  createdAt: number;
}

export class FlashcardDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    // DELETE /flashcards/:id
    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers: cors });
      await this.deleteFlashcard(id);
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    }

    // GET /flashcards — list all
    const flashcards = await this.getFlashcards();
    return new Response(JSON.stringify(flashcards), { headers: cors });
  }

  async getFlashcards(): Promise<Flashcard[]> {
    const list = await this.ctx.storage.list<Flashcard>({ prefix: "flashcard:" });
    return Array.from(list.values()).sort((a, b) => b.createdAt - a.createdAt);
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
