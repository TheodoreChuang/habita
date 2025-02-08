import dotenv from "dotenv";
import Groq from "groq-sdk";

import { ConversationState } from "../types/states";
import { DatabaseService } from "./database";

dotenv.config();

type ChatCompletionMessageParam = {
  role: "system" | "user" | "assistant";
  content: string;
};

const stateSpecificPrompts = {
  [ConversationState.INITIAL_DISCOVERY]: `The user is in the initial discovery phase. Valid inputs include personal health background, health concerns, current lifestyle or health priorities.`,
  [ConversationState.GOAL_SETTING]: `The user is in the goal-setting phase. Valid inputs include specific health goals or areas of focus (e.g., sleep, stress, exercise, diet).`,
  [ConversationState.ACTION_PLANNING]: `The user is in the action-planning phase. Valid inputs include specific actions, steps, or timelines for achieving their goals.`,
  [ConversationState.ACTIVE_COACHING]: `The user is in the active coaching phase. Valid inputs include progress updates, challenges, or reflections on their actions.`,
  [ConversationState.PROGRESS_REVIEW]: `The user is in the progress review phase. Valid inputs include reflections on their progress, adjustments to their goals, or new areas of focus.`,
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
    // Step 1: Keyword-based validation
    const invalidKeywords = ["hi", "hello", "hey", "i don't know", "not sure"];
    const isInvalidKeyword = invalidKeywords.some((keyword) =>
      userInput.toLowerCase().includes(keyword)
    );

    if (isInvalidKeyword) {
      return {
        isValid: false,
        feedback:
          "I understand, but let's focus on your health goals. Could you provide more details?",
      };
    }

    // Step 2: LLM-based validation
    const prompt = `You are a health coach guiding a user through a conversation. The user is currently in the "${currentState}" state. Their input is: "${userInput}". 

    ${stateSpecificPrompts[currentState]}
  
    Your task is to determine if the input is relevant to the current state of coaching. Always respond with a JSON object containing:
    - "isValid": A boolean indicating whether the input is valid.
    - "feedback": A message to guide the user if the input is invalid.
  
    Example response for an invalid input:
    {
      "isValid": false,
      "feedback": "That's an interesting thought, but let's focus on your health goals for now. Could you tell me more about your sleep habits?"
    }
  
    Example response for a valid input:
    {
      "isValid": true,
      "feedback": "Great! Let's continue."
    }`;

    const response = await this.generateResponse(userId, [
      { role: "system", content: prompt },
      { role: "user", content: userInput },
    ]);

    console.debug("GroqService.validateInput.response", response);

    try {
      // Parse the LLM's response as JSON
      const validationResult = JSON.parse(response);
      return {
        isValid: validationResult.isValid,
        feedback: validationResult.feedback,
      };
    } catch (error) {
      console.error("Error parsing validation response:", error);
      return {
        isValid: false,
        feedback:
          "I'm having trouble understanding your input. Could you please rephrase?",
      };
    }
  }
}
