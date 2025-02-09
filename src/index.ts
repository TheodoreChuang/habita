import dotenv from "dotenv";
import { DatabaseService } from "./services/database";
import {
  TelegramService,
  TelegramEvents,
  ParsedMessage,
} from "./services/telegram";
import { ConversationManager } from "./services/conversation-manager";

dotenv.config();

class HabitaApp {
  private db: DatabaseService;
  private telegramService: TelegramService;
  private conversationManager: ConversationManager;

  constructor() {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is required");
    }

    this.db = new DatabaseService();
    this.telegramService = new TelegramService(
      { botToken: process.env.TELEGRAM_BOT_TOKEN },
      this.db
    );
    this.conversationManager = new ConversationManager(this.db);

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Handle incoming messages
    this.telegramService.on(
      TelegramEvents.MESSAGE_RECEIVED,
      async (message: ParsedMessage) => {
        try {
          console.log("Received message:", message);

          await this.handleConversation(message);
        } catch (error) {
          console.error("Error handling message:", error);
          await this.handleError(message, error);
        }
      }
    );

    // Handle conversation state transitions
    this.conversationManager.on(
      "generatedResponse",
      async (event: {
        userId: string; // This is now the UUID
        message: string;
        chatId: number; // Add this to avoid looking up user again
      }) => {
        try {
          await this.telegramService.sendMessage(event.chatId, event.message);
        } catch (error) {
          console.error("Error handling state transition:", error);
        }
      }
    );

    // Handle errors
    this.telegramService.on(TelegramEvents.ERROR, (error: Error) => {
      console.error("Telegram service error:", error);
    });
  }

  private async handleConversation(message: ParsedMessage) {
    const user = await this.db.getUser(message.internalUserId);
    if (!user) {
      await this.telegramService.sendMessage(
        message.chatId,
        "Please start a new conversation with /start"
      );
      return;
    }

    // Add chatId to the message for the conversation manager
    const enrichedMessage = {
      ...message,
      internalUserId: user.id, // Add the internal UUID
    };

    // Process message through conversation manager
    await this.conversationManager.handleMessage(enrichedMessage);
  }

  private async handleError(message: ParsedMessage, error: any) {
    console.error("Error in message handling:", error);

    const errorMessage =
      "I apologize, but I encountered an error processing your message. Please try again or use /help to see available commands.";

    await this.telegramService.sendMessage(message.chatId, errorMessage);
  }

  async start() {
    console.log("Starting Habita Health Coach...");
    this.telegramService.start();
    console.log("Bot is ready to receive messages!");
  }

  async stop() {
    await this.db.disconnect();
  }
}

// Start the application
const app = new HabitaApp();

// Handle graceful shutdown
process.once("SIGINT", () => {
  console.log("Shutting down...");
  app.stop();
});

process.once("SIGTERM", () => {
  console.log("Shutting down...");
  app.stop();
});

// Start the app
app.start().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
