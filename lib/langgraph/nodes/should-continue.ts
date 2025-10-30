import { AIMessage } from '@langchain/core/messages';
import { END } from '@langchain/langgraph';

/**
 * Conditional routing function to determine if graph should continue to ToolNode or end
 * Returns 'tools' if last message has tool calls, otherwise END
 */
export function shouldContinue(state: { messages: any[] }): 'tools' | typeof END {
  const { messages } = state;
  if (!messages || messages.length === 0) {
    return END;
  }

  const lastMessage = messages[messages.length - 1];

  // Check if last message is AIMessage with tool calls
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }

  return END;
}
