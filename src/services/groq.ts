import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

type ChatCompletionMessageParam = {
  role: "system" | "user" | "assistant";
  content: string;
};
export class GroqService {
  private groq: Groq;

  constructor() {
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
        max_tokens: 250, // Adjusted from `max_completion_tokens`
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
