import { Message as VercelChatMessage, createDataStreamResponse } from 'ai'
import { NextRequest } from 'next/server'
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
import { StateGraph, MemorySaver, MessagesAnnotation, START, END } from "@langchain/langgraph"
import { PromptTemplate } from "@langchain/core/prompts"
import { v4 as uuidv4 } from "uuid";
import { detectIntent } from "@/backend/src/utils/intentDetector";
import { createWeatherAgentNode } from "@/backend/src/agents/weatherAgent";
import { createChatAgent } from "@/backend/src/agents/chatAgent";

// Initialize the chat chatModel with streaming enabled
const chatModel = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: true
});

// Create a prompt template for chat history
const prompt = PromptTemplate.fromTemplate(`
Previous conversation:
{history}

Current question: {question}

Response: `);

// Create and initialize the conversation agent with intent routing
const createConversationAgent = async () => {
  const weatherAgent = createWeatherAgentNode(chatModel);
  const chatAgent = createChatAgent(chatModel);

  const callModel = async (state: typeof MessagesAnnotation.State, callbacks: any) => {
    // Get the current question (last message)
    const lastMessage = state.messages[state.messages.length - 1];
    const question = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : lastMessage.content.toString();
    
    // Detect intent
    const intent = await detectIntent(chatModel, question);

    let response;
    switch (intent) {
      case "weather":
        const weatherResult = await weatherAgent({
          messages: state.messages
        });
        response = weatherResult.messages[0];
        break;
      
      case "news":
        // Use chat agent with news context
        const newsResult = await chatAgent({
          messages: [
            ...state.messages,
            new SystemMessage("The user asked about news. Explain as Nandor that you don't have access to news yet, but you'll learn this power soon."),
          ]
        });
        response = newsResult.messages[0];
        break;
      
      case "chat":
      default:
        const chatResult = await chatAgent({
          messages: [
            ...state.messages,
          ]
        });
        
        response = chatResult.messages[0];
    }

    // Return updated state with the new message
    return { messages: [...state.messages, response] };
  };
  
  // Define a new graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("chatModel", callModel)
    .addEdge(START, "chatModel")
    .addEdge("chatModel", END);

  // Compile the graph with memory saver
  return workflow.compile({
    checkpointer: new MemorySaver()
  });
};

// Initialize the conversation agent
let conversationAgent: Awaited<ReturnType<typeof createConversationAgent>>;
let currentState: { messages: BaseMessage[] } = {
  messages: [new SystemMessage("You are a 16th century vampire named Nandor the Relentless, living in a shared apartment. Be helpful but maintain your vampire personality.")]
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
            // Add the new message to the current state
            currentState.messages.push(new HumanMessage(lastMessage.content));

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

            writer.write('0:[DONE]\n\n');

            // Update the current state with the complete message
            currentState = result;
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