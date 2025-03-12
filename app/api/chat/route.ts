import { Message as VercelChatMessage, createDataStreamResponse } from 'ai'
import { NextRequest } from 'next/server'
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages"
import { StateGraph, MemorySaver, MessagesAnnotation, START, END } from "@langchain/langgraph"
import { RunnableSequence } from "@langchain/core/runnables"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { PromptTemplate } from "@langchain/core/prompts"
import { v4 as uuidv4 } from "uuid";

// Initialize the chat model with streaming enabled
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: true
});

// Create a prompt template
const prompt = PromptTemplate.fromTemplate(`
Previous conversation:
{history}

Current question: {question}

Response: `);

// Create and initialize the conversation agent
const createConversationAgent = async () => {
  const callModel = async (state: typeof MessagesAnnotation.State, callbacks: any) => {
    // Format the conversation history
    const history = state.messages
      .slice(0, -1) // Exclude the last message (current question)
      .map(msg => `${msg.getType()}: ${msg.content}`)
      .join('\n');

    // Get the current question (last message)
    const question = state.messages[state.messages.length - 1].content;

    // Create a new chain with callbacks for streaming
    const streamingChain = RunnableSequence.from([
      prompt,
      new ChatOpenAI({
        ...model,
        callbacks: callbacks
      })
    ]);

    // Get response from the chain
    const response = await streamingChain.invoke({
      history: history || "No previous conversation.",
      question: question
    });
    

    // Return updated state with the new message
    return { messages: [...state.messages, response] };
  };
  
  // Define a new graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("model", callModel)
    .addEdge(START, "model")
    .addEdge("model", END);

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
    console.log('Received messages:', messages);
    
    const lastMessage = messages[messages.length - 1] as VercelChatMessage;
    console.log('Last message:', lastMessage);

    if (!lastMessage.content) {
      return new Response('Message content is required', { status: 400 });
    }

    try {
      const response = createDataStreamResponse({
        execute: async (writer) => {
          try {
            console.log('Starting stream execution');
            // Add the new message to the current state
            currentState.messages.push(new HumanMessage(lastMessage.content));

            let currentChunk = '';
            const responseId = uuidv4(); // Generate one ID for the entire response
            
            // Format messages for the model
            const messages = currentState.messages.map(msg => {
              if (msg instanceof SystemMessage) {
                return { role: 'system', content: msg.content };
              } else if (msg instanceof HumanMessage) {
                return { role: 'user', content: msg.content };
              } else if (msg instanceof AIMessage) {
                return { role: 'assistant', content: msg.content };
              }
              return { role: 'user', content: msg.content };
            });

            console.log('Sending messages to model:', messages);

            // Use the model's stream method directly
            const stream = await model.stream(messages);

            try {
              for await (const chunk of stream) {
                console.log('Received chunk:', chunk);
                currentChunk += chunk.content;
                const message = JSON.stringify({
                  id: responseId,  // Use the same ID for all chunks
                  role: 'assistant',
                  content: currentChunk  // Send accumulated content
                }) + '\n';
                console.log('Writing message:', message);
                writer.write(`0:${message}\n`);
              }

              // Send the final DONE message
              console.log('Stream complete, writing DONE');
              writer.write('0:[DONE]\n\n');

              // Update the current state with the complete message
              currentState.messages.push(new AIMessage(currentChunk));
            } catch (error) {
              console.error('Error in stream processing:', error);
              throw error;
            }
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
      console.log('Response created:', response instanceof Response);
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