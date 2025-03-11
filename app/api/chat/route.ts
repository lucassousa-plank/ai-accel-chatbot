import { NextResponse } from 'next/server'
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
import { StateGraph, MemorySaver, MessagesAnnotation, START, END } from "@langchain/langgraph"
import { RunnableSequence } from "@langchain/core/runnables"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { PromptTemplate } from "@langchain/core/prompts"
import { v4 as uuidv4 } from "uuid";

// Initialize the chat model
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

// Create a prompt template
const prompt = PromptTemplate.fromTemplate(`
You are a helpful AI assistant. Please provide a clear and concise response to the following question, taking into account the conversation history:

Previous conversation:
{history}

Current question: {question}

Response: `)

// Create the chain
const chain = RunnableSequence.from([
  prompt,
  model,
  new StringOutputParser(),
])

// Create and initialize the conversation agent
const createConversationAgent = async () => {
  const callModel = async (state: typeof MessagesAnnotation.State) => {
    // Log the entire state
    console.log("Current conversation state:", {
      messageCount: state.messages.length,
      messages: state.messages.map(msg => ({
        type: msg.getType(),
        content: msg.content
      }))
    });

    // Format the conversation history
    const history = state.messages
      .slice(0, -1) // Exclude the last message (current question)
      .map(msg => `${msg.getType()}: ${msg.content}`)
      .join('\n');

    // Get the current question (last message)
    const question = state.messages[state.messages.length - 1].content;

    console.log("Formatted history:", history);
    console.log("Current question:", question);

    // Get response from the chain
    const response = await chain.invoke({
      history: history || "No previous conversation.",
      question: question
    });

    console.log("Model response:", response);

    // Create a new message with the response
    const newMessage = new HumanMessage(response);

    // Return updated state with the new message
    return { messages: [...state.messages, newMessage] };
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
}

// Initialize the conversation agent
let conversationAgent: Awaited<ReturnType<typeof createConversationAgent>>;
let currentState: { messages: BaseMessage[] } = {
  messages: [new SystemMessage("You are a helpful AI assistant. Please provide clear and concise responses.")]
};

// Initialize the agent when the module loads
createConversationAgent().then(agent => {
  conversationAgent = agent;
});

export async function POST(request: Request) {
  try {
    const { question } = await request.json()

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      )
    }

    if (!conversationAgent) {
      return NextResponse.json(
        { error: "Conversation agent not initialized" },
        { status: 500 }
      )
    }

    console.log("Starting chat interaction with question:", question)
    console.log("Current state before processing:", {
      messageCount: currentState.messages.length,
      messages: currentState.messages.map(msg => ({
        type: msg.getType(),
        content: msg.content
      }))
    });

    // Add the new question to the current state
    currentState.messages.push(new HumanMessage(question));

    // Process the message with session tracking
    const result = await conversationAgent.invoke(
      currentState,
      { configurable: { thread_id: uuidv4() } }
    );

    // Update the current state with the result
    currentState = result;

    console.log("Result after processing:", {
      messageCount: result.messages.length,
      messages: result.messages.map(msg => ({
        type: msg.getType(),
        content: msg.content
      }))
    });

    // Extract the last message (AI's response)
    const lastMessage = result.messages[result.messages.length - 1];
    const response = lastMessage.content;

    console.log("Final response:", response)
    return NextResponse.json({ response })
  } catch (error) {
    console.error("Error getting chat response:", error)
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    )
  }
}