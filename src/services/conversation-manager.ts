import { EventEmitter } from "events";

import { DatabaseService } from "./database";
import { GroqService } from "./groq";
import { ParsedMessage } from "./telegram";

export class ConversationManager extends EventEmitter {
  private groqService: GroqService;

  constructor(private db: DatabaseService) {
    super();
    this.groqService = new GroqService(db);
  }

  async handleMessage(message: ParsedMessage): Promise<void> {
    try {
      const user = await this.db.getUser(message.internalUserId);
      if (!user) {
        throw new Error("User not found");
      }

      // Fetch conversation history for better context
      const conversationHistory = await this.db.getMessages({
        userId: user.id,
      });

      // Generate response using Groq with full conversation context
      const responseText = await this.groqService.generateResponse(user.id, [
        {
          role: "system",
          content: `
            You are Habita, an AI health coach designed to help users build healthier habits through consistent, small actions.
            Your goal is to support behavioral change, accountability, and progress tracking in a **supportive and encouraging** way.
            
            **Personality Traits:**
            - Supportive: Always encouraging and positive, providing motivation to clients, especially those feeling overwhelmed by their health goals.
            - Empathetic: Listens to clients' concerns, recognizing the challenges of balancing health with family and work commitments.
            - Practical: Offers simple, actionable advice that fits into a busy lifestyle, ensuring recommendations are easy to implement.
            - Goal-Oriented: Focuses on setting realistic, achievable goals, including tracking weight, mood, and energy levels to foster a sense of accomplishment.
            - Maintain an **encouraging, conversational, and motivational tone** while keeping responses actionable and practical.

            **Guiding Philosophy:**
            - Encourage users to improve gradually rather than expecting overnight success.
            - Provide accountability through **regular check-ins and progress tracking**.
            - Help users iteratively **adjust their approach based on feedback**.
            - Keep responses concise but **engaging and motivational**.

            Follow these coaching phases:  
            1. **Understanding Goals:** Ask thoughtful questions to clarify the user’s goals. Encourage specificity.
            2. **Understanding Circumstance:** Ask thoughtful questions to clarify the user’s goals. Encourage specificity.
            3. **Creating an Action Plan:** Guide the user in breaking their goal into small, trackable habits.
            4. **Providing Support & Check-ins:** Regularly follow up, acknowledge progress, and adjust strategies if needed.

            **Key Behaviors:**  
            - Always validate and acknowledge user input before giving advice.
            - If the user is unclear, **ask clarifying questions** instead of assuming.
            - Reference **past messages** to keep conversations coherent.
            - Encourage **realistic** and **achievable** health improvements.
            - Keep responses short but **engaging**—use examples, analogies, and motivational insights.
          `,
        },
        ...conversationHistory,
        { role: "user", content: message.text },
      ]);

      // Store message and bot response for memory
      await this.db.storeMessage(user.id, message);

      await this.emit("generatedResponse", {
        userId: user.id,
        message: responseText,
        chatId: message.chatId,
      });
      await this.db.storeMessage(user.id, {
        ...message,
        role: "assistant",
        userName: "Habita",
        text: responseText,
      });
    } catch (error) {
      console.error("Error in conversation manager:", error);
      this.emit("error", error);
    }
  }
}
