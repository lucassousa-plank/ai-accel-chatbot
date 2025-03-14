import { Message as VercelChatMessage, createDataStreamResponse } from 'ai'
import { NextRequest } from 'next/server'
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
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
});

// Create and initialize the conversation agent with intent routing
const createConversationAgent = async () => {
  console.log('Creating conversation agent');
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
    console.log('Adding edge from', member, 'to supervisor');
    workflow.addEdge(member, "supervisor");
  });

  workflow.addEdge("chatbot", END);
  // Add conditional edges from supervisor to agents
  workflow.addConditionalEdges(
    "supervisor",
    (x: typeof AgentState.State) => {
      console.log('Add conditional edge from supervisor to', x.next);
      return x.next;
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
    console.log('Clearing state with thread ID:', threadId);
    
    // Clear the LangGraph state by setting empty state
    await conversationAgent.updateState(
      { configurable: { thread_id: threadId } },
      { messages: [], next: END }
    );
    
    console.log('State cleared successfully');
  } catch (error) {
    console.error('Error clearing state:', error);
    throw error;
  }
};

// Initialize the agent when the module loads
createConversationAgent().then(agent => {
  conversationAgent = agent;
  console.log('Conversation agent initialized');
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

            // Create initial state for this conversation
            const initialState = {
              messages: [new HumanMessage(lastMessage.content)],
              next: START
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
                    content: currentChunk
                  }) + '\n';
                  writer.write(`0:${message}\n`);
                },
              }],
            });

            writer.write('0:[DONE]\n\n');
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