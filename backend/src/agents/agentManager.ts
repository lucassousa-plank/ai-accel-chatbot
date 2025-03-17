import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph, MemorySaver, Annotation, START, END } from "@langchain/langgraph";
import { createWeatherAgentNode } from "./weatherAgent";
import { createChatAgent } from "./chatAgent";
import { createNewsAgentNode } from "./newsAgent";
import { createSupervisorChain, members } from "./supervisorChain";
import { createSummaryNode } from "./summaryAgent";

// Initialize the chat model with streaming enabled
const chatModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: true
});

// Initialize a separate model for the other models that don't need streaming
const baseModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: false
});

// Define the state object that is passed between nodes
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? END,
    default: () => END,
  }),
  invokedAgents: Annotation<string[]>({
    reducer: (x, y) => {
      const current = Array.isArray(x) ? x : [];
      if (Array.isArray(y) && y.length === 0) return [];
      if (!y) return current;
      if (typeof y === 'string' && y !== END && y !== START) {
        return Array.from(new Set([...current, y]));
      }
      if (Array.isArray(y)) {
        const filtered = y.filter(agent => agent !== END && agent !== START);
        return Array.from(new Set([...current, ...filtered]));
      }
      return current;
    },
    default: () => [],
  }),
  summary: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
});

// Create and initialize the conversation agent
const createConversationAgent = async () => {
  const weatherAgent = createWeatherAgentNode(baseModel);
  const newsAgent = createNewsAgentNode(baseModel);
  const chatAgent = createChatAgent(chatModel);
  const summaryNode = createSummaryNode(baseModel);
  const supervisorChain = await createSupervisorChain(baseModel);
  
  const workflow = new StateGraph(AgentState)
    .addNode("weather_reporter", weatherAgent)
    .addNode("news_reporter", newsAgent)
    .addNode("chatbot", chatAgent)
    .addNode("summary_agent", summaryNode)
    .addNode("supervisor", supervisorChain);

  members.filter(member => member !== 'chatbot').forEach((member) => {
    workflow.addEdge(member, "supervisor");
  });

  workflow.addEdge("chatbot", "summary_agent");
  workflow.addEdge("summary_agent", END);
  
  workflow.addConditionalEdges(
    "supervisor",
    (x: typeof AgentState.State) => {
      const nextAgent = x.next;
      if (nextAgent && nextAgent !== END && nextAgent !== START) {
        x.invokedAgents = [nextAgent];
      }
      return nextAgent;
    },
  );

  workflow.addEdge(START, "supervisor");

  return workflow.compile({
    checkpointer: new MemorySaver()
  });
};

// Singleton instance of the conversation agent
let conversationAgent: Awaited<ReturnType<typeof createConversationAgent>>;

// Get or create the conversation agent
export const getConversationAgent = async () => {
  if (!conversationAgent) {
    conversationAgent = await createConversationAgent();
  }
  return conversationAgent;
};

// Clear the agent state
export const clearState = async (threadId: string) => {
  const agent = await getConversationAgent();
  try {
    await agent.updateState(
      { configurable: { thread_id: threadId } },
      { messages: [], next: END }
    );
  } catch (error) {
    console.error('Error clearing state:', error);
    throw error;
  }
}; 