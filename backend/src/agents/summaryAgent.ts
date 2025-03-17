import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AgentState } from "../types";
import { RunnableConfig } from "@langchain/core/runnables";

export const createSummaryNode = (model: ChatOpenAI) => {
  // Create the summary agent
  const summaryAgent = createReactAgent({
    llm: model,
    tools: [],
    stateModifier: new SystemMessage(
      `You are a summarization agent that maintains a concise summary of the ongoing conversation.
Focus on key points, decisions, and the overall context of the discussion.
If the conversation is just starting, simply state that this is the beginning of the conversation.

Analyze the conversation history and provide a concise summary of the key points.
The new summary must keep the important information from the previous summary, in addition to the last few messages of the conversation.
Provide ONLY the new summary, nothing else.`
    ),
  });

  return async (state: AgentState, config?: RunnableConfig) => {
    console.log('\n=== Summary Agent Start ===');
    console.log('Total messages in state:', state.messages.length);
    console.log('Current summary:', state.summary);

    // If there are no messages, return initial state
    if (state.messages.length === 0) {
      console.log('No messages, returning initial state');
      return {
        next: "supervisor",
        summary: "This is the beginning of the conversation."
      };
    }

    // Get the last 3 messages or all messages if less than 3
    const recentMessages = state.messages.slice(-3);
    console.log('\nLast messages to summarize:');
    recentMessages.forEach((msg, i) => {
      console.log(`[${i + 1}] ${msg._getType()}: ${msg.content}`);
    });

    // Add the current summary as a system message
    const messagesWithContext = [
      new SystemMessage(`Current conversation summary: ${state.summary || "No summary yet."}`),
      ...recentMessages
    ];

    console.log('\nPassing messages to agent:', messagesWithContext);

    // Generate new summary using the React agent
    const result = await summaryAgent.invoke({ messages: messagesWithContext }, config);
    const lastMessage = result.messages[result.messages.length - 1];

    console.log('\nNew summary generated:', lastMessage.content);
    console.log('=== Summary Agent End ===\n');

    return {
      next: "supervisor",
      summary: lastMessage.content as string
    };
  };
}; 