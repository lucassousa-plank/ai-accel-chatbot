import { BaseMessage } from "@langchain/core/messages";

// Define the state type for our agents
export interface AgentState {
  messages: BaseMessage[];
  next?: AgentType;
  __root__?: AgentType;
  invokedAgents?: string[];
  summary?: string;
}

// Define the available agent types
export type AgentType = "weather_reporter" | "news_reporter" | "chatbot" | "supervisor" | "__start__" | "__end__";

export type AgentUpdate = Partial<AgentState>;

export interface AgentResponse extends AgentUpdate {
  messages: BaseMessage[];
  next?: AgentType;
  invokedAgents?: string[];
  summary?: string;
} 