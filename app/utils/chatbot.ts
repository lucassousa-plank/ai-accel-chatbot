import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableConfig } from "@langchain/core/runnables";

// Initialize the chat model
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

// Create a prompt template
const prompt = PromptTemplate.fromTemplate(`
You are a helpful AI assistant. Please provide a clear and concise response to the following question:

Question: {question}

Response: `);

// Create the chain
export const chain = RunnableSequence.from([
  prompt,
  model,
  new StringOutputParser(),
]);

// Function to get chat response
export async function getChatResponse(
  question: string,
  config?: RunnableConfig
) {
  try {
    console.log("Starting chat interaction...");
    console.log("Environment variables:", {
      OPENAI_API_KEY: process.env.NEXT_PUBLIC_OPENAI_API_KEY ? "Present" : "Missing",
      LANGCHAIN_API_KEY: process.env.LANGCHAIN_API_KEY ? "Present" : "Missing",
      LANGCHAIN_ENDPOINT: process.env.LANGCHAIN_ENDPOINT,
      LANGCHAIN_PROJECT: process.env.LANGCHAIN_PROJECT,
    });

    const response = await chain.invoke(
      { question },
      {
        ...config,
        tags: ["chatbot"],
        metadata: {
          project: process.env.LANGCHAIN_PROJECT,
        },
      }
    );

    console.log("Got response:", response);
    return response;
  } catch (error) {
    console.error("Error getting chat response:", error);
    throw error;
  }
}

// Function to format chat history
export function formatChatHistory(messages: Array<{ role: string; content: string }>) {
  return messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
} 