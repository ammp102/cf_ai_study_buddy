export interface Flashcard {
  id: string;
  term: string;
  definition: string;
  createdAt: number;
}

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: string;
  createdAt: number;
}

export interface Session {
  id: string;
  title: string;
  created_at: number;
}
