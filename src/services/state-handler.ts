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
    state: ConversationState
  ): Promise<void> {
    await this.db.updateUserState(userId, state);
  }
}

export class InitialDiscoveryHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    return {
      nextState: ConversationState.INITIAL_DISCOVERY,
      response: "Welcome! Let's start by learning about your health goals.",
      stateData: {},
    };
  }
}

export class GoalSettingHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    // Ensure stateData is treated as an object
    const stateData = (context.stateData as JsonObject) || {};

    if (!stateData.goalCategory) {
      return {
        nextState: ConversationState.GOAL_SETTING,
        response:
          "What area of your health would you like to improve? (e.g., sleep, diet, exercise, stress)",
        stateData: { ...stateData, goalCategory: message.text },
      };
    }

    return {
      nextState: ConversationState.ACTION_PLANNING,
      response: `Got it! Let's define specific actions to improve your ${stateData.goalCategory}.`,
    };
  }
}

export class ActionPlanningHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    return {
      nextState: ConversationState.ACTIVE_COACHING,
      response:
        "Great! I’ll remind you to take this action regularly. Let's check in on your progress soon!",
    };
  }
}

export class ActiveCoachingHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    return {
      nextState: ConversationState.PROGRESS_REVIEW,
      response: "How are you feeling about your progress so far?",
    };
  }
}

export class ProgressReviewHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    return {
      nextState: ConversationState.GOAL_SETTING,
      response: "Would you like to set a new goal or adjust your current plan?",
    };
  }
}
