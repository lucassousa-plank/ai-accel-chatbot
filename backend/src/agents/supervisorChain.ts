import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";

const members = ["weather_reporter", "news_reporter", "chatbot"] as const;
const options = [...members] as const;

const routingTool = {
  name: "route",
  description: "Select the next role to handle the request.",
  schema: z.object({
    next: z.enum(members),
  }),
};

export const createSupervisorChain = async (model: ChatOpenAI) => {
  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    new SystemMessage(`You are a task router. Analyze the user's request and conversation history.

Available agents:
- weather_reporter: For weather-related queries
- news_reporter: For news and current events queries
- chatbot: For general conversation and final responses

Routing rules:
1. Route to weather_reporter or news_reporter for their specific queries
2. After each specialized agent provides data, route to chatbot
3. For general conversation, route directly to chatbot
4. The chatbot will end the conversation

Multi-task handling:
- If the user asks for multiple things (e.g., "weather and news"), handle one task at a time
- Check the conversation history:
  - If weather data is missing and requested, route to weather_reporter
  - If news data is missing and requested, route to news_reporter
  - If all requested data is present, route to chatbot

Return EXACTLY one of: ${options.join(", ")}`),
    new MessagesPlaceholder("messages"),
    new HumanMessage(`Which agent should handle the next step? Select one of: ${options.join(", ")}`),
  ]);

  return supervisorPrompt
    .pipe(model.bindTools([routingTool], { tool_choice: "route" }))
    .pipe((x) => {
      const args = x.tool_calls?.[0]?.args;
      if (!args?.next || !options.includes(args.next)) {
        throw new Error(`Invalid next value: ${args?.next}. Must be one of: ${options.join(", ")}`);
      }
      return { next: args.next };
    });
};

export { members, options };