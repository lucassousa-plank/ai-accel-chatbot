import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentType } from "../types";

// Create a non-streaming model specifically for intent detection
const intentModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  streaming: false
});

export async function detectIntent(model: ChatOpenAI, query: string): Promise<AgentType> {  
  const response = await intentModel.invoke([
    new SystemMessage(`You are an intent classifier. Your job is to classify user queries into one of these categories:
- "weather": For queries about weather conditions, forecasts, or temperature
- "news": For queries about current events, news updates, or headlines
- "chat": For general conversation, questions, or anything else

Respond ONLY with the category name in lowercase, nothing else.`),
    new HumanMessage(query)
  ]);

  const intent = response.content.toString().toLowerCase().trim() as AgentType;
  return intent;
} 