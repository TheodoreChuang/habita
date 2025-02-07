import { JsonObject } from "@prisma/client/runtime/library";

import { ParsedMessage } from "./telegram";
import {
  ConversationState,
  StateContext,
  StateTransitionResult,
} from "../types/states";
import { DatabaseService } from "./database";

export abstract class BaseStateHandler {
  constructor(protected db: DatabaseService) {}

  abstract handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult>;

  protected async updateUserState(
    userId: string,
    state: ConversationState,
    stateData?: Record<string, any>
  ): Promise<void> {
    await this.db.updateUserState(userId, state, stateData);
  }
}

export class InitialDiscoveryHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    const stateData = (context.stateData as JsonObject) || {};

    // Initial greeting
    if (!stateData.hasStarted) {
      return {
        nextState: ConversationState.INITIAL_DISCOVERY,
        response:
          "Welcome to Habita! I'm your personal health coach. Let's start by getting to know each other. What's your name?",
        stateData: { hasStarted: true, hasAskedName: true },
      };
    }

    // Collecting name
    if (stateData.hasAskedName && !stateData.name) {
      return {
        nextState: ConversationState.INITIAL_DISCOVERY,
        response: `Great to meet you, ${message.text}! What brought you to seek a health coach? What are your main health concerns or goals?`,
        stateData: { ...stateData, name: message.text, hasAskedGoals: true },
      };
    }

    // Collecting initial goals
    if (stateData.hasAskedGoals && !stateData.initialGoals) {
      return {
        nextState: ConversationState.INITIAL_DISCOVERY,
        response:
          "Thank you for sharing. To help me understand better, could you rate your current satisfaction with these aspects of your health on a scale of 1-10?\n- Sleep quality\n- Energy levels\n- Stress management\n- Physical activity",
        stateData: {
          ...stateData,
          initialGoals: message.text,
          hasAskedRatings: true,
        },
      };
    }

    // Collecting health ratings
    if (stateData.hasAskedRatings && !stateData.healthRatings) {
      return {
        nextState: ConversationState.GOAL_SETTING,
        response:
          "Thanks for those ratings. I notice we could make some improvements. Let's set some specific goals to work on. Which area would you like to focus on first?",
        stateData: {
          ...stateData,
          healthRatings: message.text,
          completedDiscovery: true,
        },
      };
    }

    // Fallback
    return {
      nextState: ConversationState.GOAL_SETTING,
      response: "Great! Let's move on to setting some specific goals.",
      stateData,
    };
  }
}

export class GoalSettingHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    const stateData = (context.stateData as JsonObject) || {};

    // Initial goal area selection
    if (!stateData.goalArea) {
      const validAreas = ["sleep", "stress", "exercise", "diet"];
      const area = message.text.toLowerCase();

      if (!validAreas.includes(area)) {
        return {
          nextState: ConversationState.GOAL_SETTING,
          response:
            "Please choose one of these areas: sleep, stress, exercise, or diet.",
          stateData,
        };
      }

      return {
        nextState: ConversationState.GOAL_SETTING,
        response: `Great choice! What specific ${area}-related goal would you like to achieve in the next 4 weeks?`,
        stateData: { ...stateData, goalArea: area, hasAskedSpecific: true },
      };
    }

    // Collecting specific goal
    if (stateData.hasAskedSpecific && !stateData.specificGoal) {
      return {
        nextState: ConversationState.GOAL_SETTING,
        response:
          "That's a good goal. How will you know when you've achieved it? What would success look like?",
        stateData: {
          ...stateData,
          specificGoal: message.text,
          hasAskedSuccess: true,
        },
      };
    }

    // Collecting success criteria
    if (stateData.hasAskedSuccess && !stateData.successCriteria) {
      return {
        nextState: ConversationState.ACTION_PLANNING,
        response:
          "Perfect! Now let's break this down into specific actions you can take. What's one small step you could take tomorrow towards this goal?",
        stateData: {
          ...stateData,
          successCriteria: message.text,
          completedGoalSetting: true,
        },
      };
    }

    return {
      nextState: ConversationState.ACTION_PLANNING,
      response:
        "Let's plan out some specific actions to help you reach your goal.",
      stateData,
    };
  }
}

export class ActionPlanningHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    const stateData = (context.stateData as JsonObject) || {};

    // Initial action step
    if (!stateData.initialAction) {
      return {
        nextState: ConversationState.ACTION_PLANNING,
        response:
          "That's a good first step. When specifically will you do this? Pick a time of day.",
        stateData: {
          ...stateData,
          initialAction: message.text,
          hasAskedTime: true,
        },
      };
    }

    // Collecting time commitment
    if (stateData.hasAskedTime && !stateData.actionTime) {
      return {
        nextState: ConversationState.ACTION_PLANNING,
        response:
          "What might get in the way of doing this? Let's identify potential obstacles.",
        stateData: {
          ...stateData,
          actionTime: message.text,
          hasAskedObstacles: true,
        },
      };
    }

    // Collecting obstacles
    if (stateData.hasAskedObstacles && !stateData.obstacles) {
      return {
        nextState: ConversationState.ACTIVE_COACHING,
        response:
          "Great awareness! I'll check in with you tomorrow to see how it went. Remember, starting small and being consistent is key to building lasting habits.",
        stateData: {
          ...stateData,
          obstacles: message.text,
          completedActionPlanning: true,
          nextCheckIn: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      };
    }

    return {
      nextState: ConversationState.ACTIVE_COACHING,
      response: "Your action plan is set! Let's start working on your goals.",
      stateData,
    };
  }
}

export class ActiveCoachingHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    const stateData = (context.stateData as JsonObject) || {};

    // Handle check-in responses
    if (!stateData.lastCheckIn) {
      return {
        nextState: ConversationState.ACTIVE_COACHING,
        response:
          "How did you do with your action step today? Did you complete it as planned?",
        stateData: {
          ...stateData,
          lastCheckIn: new Date().toISOString(),
          hasAskedCompletion: true,
        },
      };
    }

    // Process completion response
    if (stateData.hasAskedCompletion && !stateData.completionResponse) {
      const response = message.text.toLowerCase();
      if (
        response.includes("yes") ||
        response.includes("done") ||
        response.includes("complete")
      ) {
        return {
          nextState: ConversationState.ACTIVE_COACHING,
          response:
            "Great job! How difficult was it on a scale of 1-5? (1 being very easy, 5 being very difficult)",
          stateData: {
            ...stateData,
            completionResponse: true,
            hasAskedDifficulty: true,
            successCount: Number(stateData.successCount || 0) + 1,
          },
        };
      } else {
        return {
          nextState: ConversationState.ACTIVE_COACHING,
          response:
            "What got in the way? Understanding obstacles helps us adjust the plan.",
          stateData: {
            ...stateData,
            completionResponse: false,
            hasAskedObstacles: true,
          },
        };
      }
    }

    // Process difficulty rating or obstacles
    if (
      (stateData.hasAskedDifficulty || stateData.hasAskedObstacles) &&
      !stateData.dailyReflection
    ) {
      const successCount = Number(stateData.successCount || 0);

      // Check if we should move to progress review
      if (successCount >= 7) {
        // After a week of tracking
        return {
          nextState: ConversationState.PROGRESS_REVIEW,
          response:
            "You've been working on this goal for a week now. Let's review your progress!",
          stateData: {
            ...stateData,
            dailyReflection: message.text,
            readyForReview: true,
          },
        };
      }

      // Continue with daily coaching
      return {
        nextState: ConversationState.ACTIVE_COACHING,
        response:
          "Thanks for sharing. I'll check in with you again tomorrow. Keep up the good work!",
        stateData: {
          ...stateData,
          dailyReflection: message.text,
          nextCheckIn: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
        },
      };
    }

    // Default response
    return {
      nextState: ConversationState.ACTIVE_COACHING,
      response: "Keep working on your goal. I'm here to support you!",
      stateData,
    };
  }
}

export class ProgressReviewHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    const stateData = (context.stateData as JsonObject) || {};

    // Initial progress review
    if (!stateData.hasStartedReview) {
      return {
        nextState: ConversationState.PROGRESS_REVIEW,
        response:
          "Looking back at your goal, how satisfied are you with your progress on a scale of 1-10?",
        stateData: {
          ...stateData,
          hasStartedReview: true,
          hasAskedSatisfaction: true,
        },
      };
    }

    // Process satisfaction rating
    if (stateData.hasAskedSatisfaction && !stateData.satisfactionRating) {
      return {
        nextState: ConversationState.PROGRESS_REVIEW,
        response:
          "What's been working well for you? What habits or strategies have been most helpful?",
        stateData: {
          ...stateData,
          satisfactionRating: parseInt(message.text) || 0,
          hasAskedSuccesses: true,
        },
      };
    }

    // Process successes
    if (stateData.hasAskedSuccesses && !stateData.successFactors) {
      return {
        nextState: ConversationState.PROGRESS_REVIEW,
        response:
          "What could we adjust to make even more progress? Would you like to modify your goal or set a new one?",
        stateData: {
          ...stateData,
          successFactors: message.text,
          hasAskedAdjustments: true,
        },
      };
    }

    // Process adjustments and transition
    if (stateData.hasAskedAdjustments) {
      const response = message.text.toLowerCase();
      if (
        response.includes("new goal") ||
        response.includes("different") ||
        response.includes("change")
      ) {
        return {
          nextState: ConversationState.GOAL_SETTING,
          response:
            "Let's set a new goal! Which area would you like to focus on: sleep, stress, exercise, or diet?",
          stateData: {
            ...stateData,
            previousGoalCompleted: true,
            adjustments: message.text,
          },
        };
      } else {
        return {
          nextState: ConversationState.ACTION_PLANNING,
          response:
            "Great! Let's adjust your action plan. What's one small step you could take tomorrow toward your adjusted goal?",
          stateData: {
            ...stateData,
            adjustments: message.text,
            hasAdjustedGoal: true,
          },
        };
      }
    }

    // Default response
    return {
      nextState: ConversationState.GOAL_SETTING,
      response: "Would you like to set a new goal or adjust your current one?",
      stateData,
    };
  }
}
