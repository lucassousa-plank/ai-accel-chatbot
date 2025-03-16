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
  temperature: 0, // Lower temperature for more consistent routing decisions
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: false
});

// This defines the object that is passed between each node
// in the graph. We will create different nodes for each agent and tool
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // The agent node that last performed work
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? END,
    default: () => END,
  }),
  // Track which agents were invoked
  invokedAgents: Annotation<string[]>({
    reducer: (x, y) => {
      const current = Array.isArray(x) ? x : [];
      if (Array.isArray(y) && y.length === 0) {
        return [];
      }
      if (!y) return current;
      if (typeof y === 'string' && y !== END && y !== START) {
        const result = Array.from(new Set([...current, y]));
        return result;
      }
      if (Array.isArray(y)) {
        const filtered = y.filter(agent => agent !== END && agent !== START);
        const result = Array.from(new Set([...current, ...filtered]));
        return result;
      }
      return current;
    },
    default: () => [],
  }),
});

// Create and initialize the conversation agent with intent routing
const createConversationAgent = async () => {
  const weatherAgent = createWeatherAgentNode(baseModel);
  const newsAgent = createNewsAgentNode(baseModel);
  const chatAgent = createChatAgent(chatModel);
  const supervisorChain = await createSupervisorChain(baseModel);
  
  // Define a new graph
  const workflow = new StateGraph(AgentState)
    .addNode("weather_reporter", weatherAgent)
    .addNode("news_reporter", newsAgent)
    .addNode("chatbot", chatAgent)
    .addNode("supervisor", supervisorChain);

  // Add edges from each agent (except chatbot) back to supervisor
  members.filter(member => member !== 'chatbot').forEach((member) => {
    workflow.addEdge(member, "supervisor");
  });

  workflow.addEdge("chatbot", END);
  
  // Add conditional edges from supervisor to agents
  workflow.addConditionalEdges(
    "supervisor",
    (x: typeof AgentState.State) => {
      // Update the state with the next agent
      const nextAgent = x.next;
      if (nextAgent && nextAgent !== END && nextAgent !== START) {
        x.invokedAgents = [nextAgent];
      }
      return nextAgent;
    },
  );

  // Start with supervisor
  workflow.addEdge(START, "supervisor");

  // Compile the graph with memory saver
  return workflow.compile({
    checkpointer: new MemorySaver()
  });
};

// Initialize the conversation agent
export let conversationAgent: Awaited<ReturnType<typeof createConversationAgent>>;

// Function to clear the state
export const clearState = async (threadId: string) => {
  try {
    // Clear the LangGraph state by setting empty state
    await conversationAgent.updateState(
      { configurable: { thread_id: threadId } },
      { messages: [], next: END }
    );
  } catch (error) {
    console.error('Error clearing state:', error);
    throw error;
  }
};

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
            const messageId = uuidv4(); // Generate unique ID for this message
            let currentAgent: string | null = null;

            // Create initial state for this conversation
            const initialState = {
              messages: [new HumanMessage(lastMessage.content)],
              next: START,
              invokedAgents: [] as string[]
            };

            // Use the conversation agent with streaming and thread_id
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
                      isThinking: true // Always thinking while streaming
                    }
                  }) + '\n';
                  writer.write(`0:${message}\n`);
                }
              }],
            });

            // Send final message with the complete list of invoked agents
            const finalMessage = JSON.stringify({
              id: messageId,
              role: 'assistant',
              content: currentChunk,
              metadata: {
                invokedAgents: result.invokedAgents || [],
                isThinking: false // Not thinking anymore, we have the final answer
              }
            }) + '\n';
            writer.write(`0:${finalMessage}\n`);
            writer.write('0:[DONE]\n\n');

            // Reset the state for the next message
            await conversationAgent.updateState(
              { configurable: { thread_id: thread_id } },
              { 
                messages: result.messages, // Keep the message history
                next: END,
                invokedAgents: [] // Reset invoked agents
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