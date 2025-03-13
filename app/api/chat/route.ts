import { Message as VercelChatMessage, createDataStreamResponse } from 'ai'
import { NextRequest } from 'next/server'
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
import { StateGraph, MemorySaver, Annotation, START, END } from "@langchain/langgraph"
import { v4 as uuidv4 } from "uuid";
import { createWeatherAgentNode } from "@/backend/src/agents/weatherAgent";
import { createChatAgent } from "@/backend/src/agents/chatAgent";
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
  const chatAgent = createChatAgent(chatModel);
  const supervisorChain = await createSupervisorChain(baseModel);
  
  // Define a new graph
  const workflow = new StateGraph(AgentState)
    .addNode("weather_reporter", weatherAgent)
    .addNode("chatbot", chatAgent)
    .addNode("supervisor", supervisorChain);

  // Add edges from each agent back to supervisor
  workflow.addEdge("weather_reporter", "chatbot");

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
let conversationAgent: Awaited<ReturnType<typeof createConversationAgent>>;
let currentState: { messages: BaseMessage[] } = {
  messages: []
};

// Initialize the agent when the module loads
createConversationAgent().then(agent => {
  conversationAgent = agent;
});

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1] as VercelChatMessage;

    if (!lastMessage.content) {
      return new Response('Message content is required', { status: 400 });
    }

    try {
      const response = createDataStreamResponse({
        execute: async (writer) => {
          try {
            console.log('Current state before update:', currentState);
            // Add the new message to the current state
            currentState.messages.push(new HumanMessage(lastMessage.content));
            console.log('State after adding new message:', currentState);

            let currentChunk = '';
            const responseId = uuidv4(); // Generate one ID for the entire response

            // Use the conversation agent with streaming and thread_id
            const result = await conversationAgent.invoke(currentState, {
              configurable: {
                thread_id: responseId // Use the responseId as the thread_id
              },
              callbacks: [{
                handleLLMNewToken(token: string) {
                  currentChunk += token;
                  const message = JSON.stringify({
                    id: responseId,
                    role: 'assistant',
                    content: currentChunk
                  }) + '\n';
                  writer.write(`0:${message}\n`);
                },
              }],
            });

            console.log('Result from conversation agent:', result);
            console.log('Next value in result:', result.next);

            writer.write('0:[DONE]\n\n');

            // Update the current state with the complete message
            currentState = result;
            console.log('Updated current state:', currentState);
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