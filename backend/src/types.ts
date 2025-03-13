import { BaseMessage } from "@langchain/core/messages";

// Define the state type for our agents
export interface AgentState {
  messages: BaseMessage[];
  next?: AgentType;
  __root__?: AgentType;
}

// Define the available agent types
export type AgentType = "weather" | "news" | "chat";

export type AgentUpdate = Partial<AgentState>;

export interface AgentResponse extends AgentUpdate {
  messages: BaseMessage[];
  next?: AgentType;
} 