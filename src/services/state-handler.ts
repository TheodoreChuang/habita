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
