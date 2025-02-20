import dotenv from "dotenv";

import { DatabaseService } from "./database";
import { GroqService } from "./groq";

dotenv.config();

const SUMMARY_MESSAGE_LIMIT = process.env.SUMMARY_MESSAGE_LIMIT
  ? parseInt(process.env.SUMMARY_MESSAGE_LIMIT)
  : 10;

export class SummaryService {
  constructor(private db: DatabaseService, private groqService: GroqService) {}

  async checkAndSummarize(userId: string): Promise<void> {
    const [lastSummary] = await this.db.getSummaries({
      userId,
      limit: 1,
      orderBy: "desc",
    });
    const lastSummaryTime = lastSummary
      ? new Date(lastSummary.createdAt)
      : undefined;

    const newMessages = await this.db.getMessages({
      userId,
      limit: SUMMARY_MESSAGE_LIMIT,
      sinceDate: lastSummaryTime,
    });

    const shouldSummarize = newMessages.length >= SUMMARY_MESSAGE_LIMIT;
    if (!shouldSummarize) return;

    // Generate summary using Groq
    const parsedMessages = this.groqService.mapChatMessages(newMessages);
    console.log("checkAndSummarize.parsedMessages:/n", parsedMessages);
    const summaryText = await this.groqService.generateResponse([
      {
        role: "system",
        content: `
          Identify the key points discussed in the conversation, including the user's goals, challenges, and progress. 
          Summarize the conversation between the user and the health coach, focusing on health-related topics and goals. 
          Provide a brief summary (less than 200 words) of the conversation, highlighting the most important points.
          If unable to summarize, please respond with "Unable to summarize due to complexity of conversation history".
        `,
      },
      ...parsedMessages,
    ]);

    await this.db.storeSummary(userId, summaryText);
  }
}
