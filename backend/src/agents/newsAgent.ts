import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AgentState } from "../types";
import { RunnableConfig } from "@langchain/core/runnables";
import { DynamicTool } from "@langchain/core/tools";
import { z } from "zod";

const newsSchema = z.object({
  query: z.string().describe("The search query for news articles"),
  count: z.number().optional().default(5).describe("Number of articles to fetch (max 10)")
});

type NewsInput = z.infer<typeof newsSchema>;

class NewsTool extends DynamicTool {
  constructor() {
    super({
      name: "fetch_news",
      description: "Fetch news articles from the News API",
      func: async (input: string) => {
        console.log('\n=== NewsTool Start ===');
        console.log('Input received:', input);
        
        try {
          // Handle both JSON and plain string inputs
          let parsedInput: NewsInput;
          try {
            // Try parsing as JSON first
            parsedInput = newsSchema.parse(JSON.parse(input));
          } catch {
            // If JSON parsing fails, treat input as a plain query string
            parsedInput = newsSchema.parse({
              query: input,
              count: 5
            });
          }
          
          const { query, count = 5 } = parsedInput;
          console.log('Parsed query:', query);
          console.log('Article count:', count);
          
          const apiKey = process.env.NEWS_API_KEY;
          if (!apiKey) {
            console.error('NEWS_API_KEY not found in environment variables');
            throw new Error("NEWS_API_KEY environment variable is not set");
          }
          
          console.log('Fetching news from API...');
          const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${count}&apiKey=${apiKey}`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status !== "ok") {
            console.error('News API error:', data.message);
            throw new Error(`News API error: ${data.message}`);
          }
          
          console.log(`Found ${data.articles.length} articles`);
          const formattedArticles = data.articles.map((article: any) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            publishedAt: article.publishedAt
          }));
          
          console.log('First article preview:', formattedArticles[0]);
          console.log('=== NewsTool End ===\n');
          
          return JSON.stringify(formattedArticles);
        } catch (error: any) {
          console.error('\n=== NewsTool Error ===');
          console.error('Error type:', error?.constructor?.name || 'Unknown');
          console.error('Error message:', error?.message || 'No error message available');
          if (error?.stack) {
            console.error('Stack trace:', error.stack);
          }
          console.error('=== NewsTool Error End ===\n');
          throw error; // Re-throw to let the agent handle it
        }
      }
    });
  }
}

export const createNewsAgentNode = (model: ChatOpenAI) => {
  const newsTool = new NewsTool();
  
  const newsAgent = createReactAgent({
    llm: model,
    tools: [newsTool],
    stateModifier: new SystemMessage(`You are a news researcher. Your job is to:
1. Analyze the user's request to understand what news they're interested in
2. Use the fetch_news tool to get relevant articles
3. Format the news in a clear, concise way
4. Always include source URLs for the articles

Keep responses focused on the news content and maintain a professional tone.`),
  });

  return async (
    state: AgentState,
    config?: RunnableConfig,
  ) => {
    console.log('\n=== News Agent Start ===');
    console.log('Message history length:', state.messages.length);
    
    const result = await newsAgent.invoke(state, config);
    
    console.log('Last message content:', result.messages[result.messages.length - 1].content);
    console.log('=== News Agent End ===\n');
    
    const lastMessage = result.messages[result.messages.length - 1];
    
    return {
      messages: [new AIMessage(lastMessage.content.toString())],
      next: "supervisor",
      invokedAgents: "news_reporter"
    };
  };
}; 