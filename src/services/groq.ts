import dotenv from "dotenv";
import Groq from "groq-sdk";

import { ConversationState } from "../types/states";
import { DatabaseService } from "./database";

dotenv.config();

type ChatCompletionMessageParam = {
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
      const msgs = await this.db.getConversationMessages(userId);

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

  async validateInput(
    userId: string,
    userInput: string,
    currentState: ConversationState
  ): Promise<{ isValid: boolean; feedback: string }> {
    const prompt = `You are a health coach guiding a user through a conversation. The user is currently in the "${currentState}" state. Their input is: "${userInput}". Is this input relevant to the current state? If not, note that the input was "invalid" and provide a gentle suggestion to guide them back on track.`;

    const response = await this.generateResponse(userId, [
      { role: "system", content: prompt },
      { role: "user", content: userInput },
    ]);

    console.debug("GroqService.validateInput.response", response);

    // Parse the LLM's response to determine if the input is valid
    // TODO improve validation (eg. "not be directly related", "isn't related", "isn't quite relevant")
    const isValid = !response.toLowerCase().includes("invalid");
    return {
      isValid,
      feedback: isValid ? "Great! Let's continue." : response, // Use the LLM's feedback if the input is invalid
    };
  }
}
