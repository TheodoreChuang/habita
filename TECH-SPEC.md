# Technical Specifications

## [TODO] Error Handling

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

## Archived

<details>
    <summary><h2 style="display:inline-block">Conversation State Machine</h2></summary>

States were used in a state machine pattern but were too rigid. Instead of explicitly tracking an user's "state", the LLM has been instructed to coach users while considering something similar.

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

</details>

<details>
    <summary><h2 style="display:inline-block">Initial ERD</h2></summary>

This was the initial ERD designed before implementation. Since implemenatation shifted to relying on the LLM these become less relevant but as we add more sophisticated we made need to revisit these entities.

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
        jsonb message
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

</details>
