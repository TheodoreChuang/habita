import { Message, Summary } from "@prisma/client";
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
    messages: ChatCompletionMessageParam[]
  ): Promise<string> {
    try {
      const response = await this.groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", // Choose your model (Mixtral, Llama3, etc.)
        messages,
        max_completion_tokens: 1024,
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

  mapChatMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages
      .map((msg) => ({
        role: (msg.message as { role: ChatCompletionMessageParam["role"] })
          .role,
        content: `${msg.createdAt}: ${(msg.message as { text: string }).text}`,
      }))
      .reverse();
  }

  mapChatSummaries(summaries: Summary[]): ChatCompletionMessageParam[] {
    return summaries
      .map((summary) => ({
        role: "assistant" as ChatCompletionMessageParam["role"],
        content: `${summary.createdAt}: ${summary.summary}`,
      }))
      .reverse();
  }
}
