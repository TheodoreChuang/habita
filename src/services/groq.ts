import dotenv from "dotenv";
import Groq from "groq-sdk";

import { DatabaseService } from "./database";

dotenv.config();

export type ChatCompletionMessageParam = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class GroqService {
  private groq: Groq;

  constructor(protected db: DatabaseService) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is required");
    }
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async generateResponse(
    userId: string,
    messages: ChatCompletionMessageParam[]
  ): Promise<string> {
    try {
      // Fetch conversation history from the database
      const msgs = await this.db.getMessages({ userId });

      // Combine the history with the current messages
      const allUserMessages: ChatCompletionMessageParam[] = [
        ...msgs.map((msg) => ({
          role: msg.role as ChatCompletionMessageParam["role"],
          content: msg.content,
        })),
        ...messages,
      ];

      const response = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", // Choose your model (Mixtral, Llama3, etc.)
        messages: allUserMessages,
        // max_completion_tokens: 32768,
      });
      return (
        response.choices?.[0]?.message?.content ||
        "I'm having trouble responding right now. Please try again later."
      );
    } catch (error) {
      console.error("Groq API error:", error);
      return "I'm having trouble responding right now. Please try again later.";
    }
  }
}
