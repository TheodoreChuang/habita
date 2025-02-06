import dotenv from 'dotenv';
import { TelegramService, TelegramEvents, ParsedMessage } from './services/telegram';

dotenv.config();

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const telegramService = new TelegramService({
    botToken: process.env.TELEGRAM_BOT_TOKEN
  });

  // Set up event listeners
  telegramService.on(TelegramEvents.MESSAGE_RECEIVED, (message: ParsedMessage) => {
    console.log('Received message in main:', message);
    
    // Handle different types of messages
    if (message.command) {
      handleCommand(telegramService, message);
    } else {
      handleMessage(telegramService, message);
    }
  });

  telegramService.on(TelegramEvents.ERROR, (error: Error) => {
    console.error('Error in main:', error);
  });

  console.log('Starting Telegram service...');
  telegramService.start();
}

// Message handlers
async function handleMessage(telegramService: TelegramService, message: ParsedMessage) {
  // Echo the message back for now
  await telegramService.sendMessage(message.chatId, `You said: ${message.text}`);
}

async function handleCommand(telegramService: TelegramService, message: ParsedMessage) {
  switch (message.command) {
    case 'start':
      await telegramService.sendMessage(
        message.chatId,
        'Welcome to Habita Health Coach! I\'m here to help you build better health habits.'
      );
      break;
    case 'help':
      await telegramService.sendMessage(
        message.chatId,
        'Available commands:\n/start - Begin your health journey\n/help - Show this message'
      );
      break;
    default:
      await telegramService.sendMessage(
        message.chatId,
        'Unknown command. Type /help to see available commands.'
      );
  }
}

main().catch(console.error);