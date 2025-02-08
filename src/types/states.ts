import { JsonValue } from "@prisma/client/runtime/library";

export enum ConversationState {
  INITIAL_DISCOVERY = "initial_discovery",
  GOAL_SETTING = "goal_setting",
  ACTION_PLANNING = "action_planning",
  ACTIVE_COACHING = "active_coaching",
  PROGRESS_REVIEW = "progress_review",
}

export interface StateContext {
  userId: string;
  chatId: number;
  currentState: ConversationState;
  stateData?: JsonValue;
}

export interface StateTransitionResult {
  nextState: ConversationState;
  response: string;
  stateData?: Record<string, any>;
}
