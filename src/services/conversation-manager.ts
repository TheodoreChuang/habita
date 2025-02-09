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
      const conversationHistory = await this.db.getConversationMessages(
        user.id
      );

      // Generate response using Groq with full conversation context
      const responseText = await this.groqService.generateResponse(user.id, [
        {
          role: "system",
          content:
            "You are an AI health coach guiding the user through goal setting, action planning, and habit tracking. Use past messages to stay on topic.",
        },
        ...conversationHistory,
        { role: "user", content: message.text },
      ]);

      // Store message and bot response for memory
      await this.db.storeMessage(user.id, message);
      await this.db.storeMessage(user.id, {
        ...message,
        role: "assistant",
        userName: "Habita",
        text: responseText,
      });

      this.emit("stateTransition", {
        userId: user.id,
        message: responseText,
        chatId: message.chatId,
      });
    } catch (error) {
      console.error("Error in conversation manager:", error);
      this.emit("error", error);
    }
  }
}
