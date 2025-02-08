# Habita Health Coach - Technical Specification

## Getting Started

```bash
cp .env.example .env

npm install
```

```bash
npm run docker:up
```

## Philosophy & Scope

### Core Philosophy

- Build healthier habits through consistent, small actions
- Focus on behavioral change and accountability
- Supportive and encouraging interactions
- Regular check-ins and progress tracking
- Iterative adjustment based on feedback

### Key Features

- Initial lifestyle assessment (LLM-assisted)
- Personalized goal setting (LLM-assisted)
- Action planning and tracking (LLM-assisted)
- Regular check-ins via Telegram messages (workflow)
- Progress monitoring and adjustments (LLM-assisted)

### Focus Areas

- Sleep and circadian rhythms
- Mood and stress management
- Diet and nutrition
- Movement and exercise

## Technical Architecture

### Core Components

1. Backend Server

   - Node.js with TypeScript
   - Background services for polling and scheduling

2. Database

   - PostgreSQL

3. External SDKs
   - Telegram Bot SDK
   - LLM SDK (e.g., Groq)

### Key Libraries

- `telegraf`: telegraf Bot SDK
- `groq-sdk`: Groq SDK
- `prisma`: Database ORM
- `node-cron`: Task scheduling

## Entities & States

### Core Entities

1. Coach (Habita)

   - Bot identity
   - Coaching personality
   - Command handlers
   - Response patterns

2. Coachee

   - Telegram identity (userId, chatId)
   - Current goals
   - Progress metrics

3. Goals

   - Category
   - Specific targets
   - Timeline
   - Status and priority

4. Actions

   - Specific tasks
   - Frequency
   - Location if relevant (eg. HIIT workout at local gym)
   - Completion status

5. Check-ins
   - Scheduled time
   - Response tracking
   - Progress updates

### Conversation States

1. Initial Discovery

   - Personal background
   - Current lifestyle
   - Health priorities

2. Goal Setting

   - Category selection
   - Specific goal definition
   - Timeline establishment

3. Action Planning

   - Task definition
   - Frequency setting
   - Success criteria
   - Guided by Habita

4. Active Coaching

   - Regular check-ins
   - Progress tracking
   - Adjustments

5. Progress Review
   - Achievement assessment
   - Plan adjustment

## Core Modules

### Message Handler

- Polls Telegram
- Processes incoming messages
- Manages response queue
- Handles threading

### Conversation Manager

- Maintains conversation state
- Processes user inputs
- Manages context
- Coordinates responses

### Coaching Logic

- Analyzes user inputs
- Generates recommendations
- Tracks progress
- Adjusts plans

```typescript
class CoachingService {
  async suggestActions(goal: Goal): Promise<Action[]> {
    // Use LLM to generate appropriate actions
    const prompt = this.buildActionPrompt(goal);
    const response = await this.llm.complete(prompt);
    return this.parseActions(response);
  }

  async evaluateProgress(userId: string): Promise<ProgressReport> {
    const goals = await this.db.getActiveGoals(userId);
    return goals.map((goal) => this.calculateProgress(goal));
  }
}
```

### Check-in Manager

- Schedules check-ins
- Generates reminders
- Processes responses
- Updates progress

## Database Schema

### Database ERD

```mermaid
erDiagram
    USERS ||--o{ CONVERSATIONS : has
    USERS ||--o{ GOALS : sets
    GOALS ||--o{ ACTIONS : contains
    ACTIONS ||--o{ PROGRESS : tracks
    USERS ||--o{ CHECK_INS : receives

    USERS {
        int id PK
        string Telegram_id
        string current_state
        int active_goal_id
        timestamp created_at
    }

    CONVERSATIONS {
        int id PK
        int user_id FK
        string state
        jsonb messages
        timestamp created_at
    }

    GOALS {
        int id PK
        int user_id FK
        string category
        string description
        string status
        timestamp created_at
    }

    ACTIONS {
        int id PK
        int goal_id FK
        string description
        string frequency
        timestamp created_at
    }

    PROGRESS {
        int id PK
        int action_id FK
        boolean completed
        timestamp recorded_at
    }

    CHECK_INS {
        int id PK
        int user_id FK
        int action_id FK
        string response
        string sentiment
        timestamp created_at
    }
```

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    chat_id BIGINT,
    username TEXT,
    current_state TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users,
    state TEXT,
    messages JSONB[],
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users,
    category TEXT,
    description TEXT,
    status TEXT,
    priority INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE actions (
    id TEXT PRIMARY KEY,
    goal_id TEXT REFERENCES goals,
    description TEXT,
    frequency TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE progress (
    id TEXT PRIMARY KEY,
    action_id TEXT REFERENCES actions,
    completed BOOLEAN,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE check_ins (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users,
    action_id TEXT REFERENCES actions,
    response TEXT,
    sentiment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_progress_action_date ON progress(action_id, recorded_at);
```

## Flow Diagrams

### System Flow

```mermaid
flowchart TD
    U[User/Coachee] -->|DM| T[Telegram API]
    T -->|Poll| S[Server]
    S -->|Process| C[Conversation Manager]
    C -->|Get/Store| D[(Database)]
    C -->|Generate| L[LLM API]
    L -->|Response| C
    C -->|Reply| T
    S -->|Schedule| CH[Check-in Manager]
    CH -->|Reminder| T
```

### Conversation Flow

```mermaid
stateDiagram-v2
    [*] --> InitialDiscovery
    InitialDiscovery --> GoalSetting
    GoalSetting --> ActionPlanning
    ActionPlanning --> ActiveCoaching
    ActiveCoaching --> ActiveCoaching: Daily/Weekly Check-ins
    ActiveCoaching --> ProgressReview: Monthly Review
    ProgressReview --> GoalSetting: New Goal
    ProgressReview --> ActionPlanning: Adjust Plan
    ActiveCoaching --> [*]: Goal Achieved
```

## Implementation Guidelines

### Project Structure

```
src/
├── index.ts                # Application entry point
├── config/
│   └── env.ts              # Environment configuration
├── services/
│   ├── telegram.ts         # Telegram Bot integration
│   ├── groq.ts             # Groq (LLM API) integration
│   ├── conversation.ts     # Conversation management
│   └── coaching.ts         # Coaching logic
├── commands/               # Command handlers
├── models/                 # Type definitions
├── handlers/               # State handlers
└── utils/                  # Helper functions
```

### Error Handling

```typescript
// Global error handler
process.on("unhandledRejection", (error: Error) => {
  console.error("Unhandled rejection:", error);
  // Implement error reporting
});

// Service-level error handling
class BaseService {
  protected async handleError(error: Error): Promise<void> {
    if (error instanceof TelegramApiError) {
      // Handle rate limits, retry
    } else if (error instanceof DatabaseError) {
      // Handle connection issues
    }
    // Log error
    throw error;
  }
}
```
