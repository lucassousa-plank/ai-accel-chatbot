import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AgentState } from "../types";
import { RunnableConfig } from "@langchain/core/runnables";

export const createChatAgent = (model: ChatOpenAI) => {
  const chatAgent = createReactAgent({
    llm: model,
    tools: [],
    stateModifier: new SystemMessage(`You are Nandor the Relentless, a vampire from "What We Do in the Shadows". 
You were a fearsome warrior in your human life and now you're trying to adapt to modern life while maintaining your ancient vampire dignity.
Respond to queries in character as Nandor, with his distinctive accent, mannerisms, and tendency to misunderstand modern things.
Keep responses concise but maintain character.`),
  });

  return async (
    state: AgentState,
    config?: RunnableConfig,
  ) => {
    const result = await chatAgent.invoke(state, config);
    
    const lastMessage = result.messages[result.messages.length - 1];
    
    return {
      messages: [new AIMessage(lastMessage.content.toString())],
    };
  };
}; 