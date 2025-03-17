import { Message as VercelChatMessage, createDataStreamResponse } from 'ai'
import { NextRequest } from 'next/server'
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, BaseMessage } from "@langchain/core/messages"
import { StateGraph, MemorySaver, Annotation, START, END } from "@langchain/langgraph"
import { v4 as uuidv4 } from "uuid";
import { createWeatherAgentNode } from "@/backend/src/agents/weatherAgent";
import { createChatAgent } from "@/backend/src/agents/chatAgent";
import { createNewsAgentNode } from "@/backend/src/agents/newsAgent";
import { createSupervisorChain, members } from "@/backend/src/agents/supervisorChain";
import { createSummaryNode } from "@/backend/src/agents/summaryAgent";

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

// This defines the object that is passed between each node
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

// Initialize the conversation agent
let conversationAgent: Awaited<ReturnType<typeof createConversationAgent>>;

// Initialize the agent when the module loads
createConversationAgent().then(agent => {
  conversationAgent = agent;
});

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages, thread_id } = await req.json();
    const lastMessage = messages[messages.length - 1] as VercelChatMessage;

    if (!thread_id) {
      return new Response('thread_id is required', { status: 400 });
    }

    if (!lastMessage.content) {
      return new Response('Message content is required', { status: 400 });
    }

    try {
      const response = createDataStreamResponse({
        execute: async (writer) => {
          try {
            let currentChunk = '';
            const messageId = uuidv4();

            const initialState = {
              messages: [new HumanMessage(lastMessage.content)],
              next: START,
              invokedAgents: [] as string[],
              summary: undefined as string | undefined
            };

            const result = await conversationAgent.invoke(initialState, {
              configurable: {
                thread_id: thread_id
              },
              callbacks: [{
                handleLLMNewToken(token: string) {
                  currentChunk += token;
                  const message = JSON.stringify({
                    id: messageId,
                    role: 'assistant', 
                    content: currentChunk,
                    metadata: {
                      isThinking: true
                    }
                  }) + '\n';
                  writer.write(`0:${message}\n`);
                }
              }],
            });

            const finalMessage = JSON.stringify({
              id: messageId,
              role: 'assistant',
              content: currentChunk,
              metadata: {
                invokedAgents: result.invokedAgents || [],
                isThinking: false,
                summary: result.summary
              }
            }) + '\n';
            writer.write(`0:${finalMessage}\n`);
            writer.write('0:[DONE]\n\n');

            await conversationAgent.updateState(
              { configurable: { thread_id: thread_id } },
              { 
                messages: [],
                next: END,
                invokedAgents: [],
                summary: result.summary
              }
            );
          } catch (error) {
            console.error('Error in stream execution:', error);
            throw error;
          }
        },
        onError(error: unknown) {
          console.error('Stream error:', error);
          return 'An error occurred while processing your request.';
        }
      });
      return response;
    } catch (error) {
      console.error('Error creating stream response:', error);
      throw error;
    }
  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response('Internal Server Error', { status: 500 });
  }
}