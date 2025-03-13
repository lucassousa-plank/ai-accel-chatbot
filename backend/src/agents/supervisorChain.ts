import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";
import { END } from "@langchain/langgraph";

const members = ["weather_reporter", "chatbot"] as const;
const options = [...members, END] as const;

const routingTool = {
  name: "route",
  description: "Select the next role to handle the request.",
  schema: z.object({
    next: z.enum([END, ...members]),
  }),
}

export const createSupervisorChain = async (model: ChatOpenAI) => {
  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    new SystemMessage(`You are a task router. Your job is to analyze the user's request and determine which agent should handle it.

Available agents:
- weather_reporter: For weather-related queries
- chatbot: For general conversation and other queries
- END: To finish the conversation

Respond ONLY with the appropriate agent name.`),
    new MessagesPlaceholder("messages"),
    new HumanMessage(`Based on the conversation above, which agent should handle the next request? Select one of: ${options.join(", ")}`),
  ]);

  console.log('Supervisor prompt:', supervisorPrompt.toString());

  return supervisorPrompt
    .pipe(model.bindTools(
      [routingTool],
      {
        tool_choice: "route",
      },
    ))
    .pipe((x) => {
      console.log('Supervisor raw output:', x);
      const args = x.tool_calls?.[0]?.args;
      console.log('Supervisor parsed args:', args);
      return args;
    })
    .pipe((output) => {
      console.log('Supervisor final decision:', output);
      const result = { next: output?.next };
      console.log('Supervisor returning:', result);
      return result;
    });
};

export { members, options };