import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { buildSystemPrompt } from '../system-prompt';
import { csvTools } from '../tools';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { AgentState } from '../agent-state';

/**
 * Node: Model (LLM Invocation)
 * Processes user query with CSV tools and generates response
 * Returns AIMessage that may contain tool_calls
 */
export async function modelNode(state: AgentState): Promise<Partial<AgentState>> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
  const modelName = process.env.LLM_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY or LLM_API_KEY environment variable is required');
  }

  const llm = new ChatGoogleGenerativeAI({
    model: modelName,
    temperature: 0,
    apiKey: apiKey,
    streaming: true, // Enable streaming for token-by-token responses
  }).bindTools(csvTools);

  // Build system prompt with CSV resource information
  const systemPrompt = buildSystemPrompt(state.csvResourcesMetadata);

  // Build message array: system prompt + history + current query
  const langchainMessages = [
    new SystemMessage(systemPrompt),
    ...state.messages, // History already contains LangChain messages
  ];

  // Add current query to messages if present (only on first call, not when looping from tools)
  let currentQueryMessage: HumanMessage | null = null;
  if (state.currentQuery) {
    const timestamp = new Date().toISOString();
    currentQueryMessage =
      state.currentQueryImages && state.currentQueryImages.length > 0
        ? (() => {
            console.log('📸 Processing message with images:', {
              queryText: state.currentQuery,
              imageCount: state.currentQueryImages.length,
              firstImageMimeType: state.currentQueryImages[0]?.mimeType,
              firstImageDataLength: state.currentQueryImages[0]?.data?.length,
            });

            const imageContents = state.currentQueryImages.map((img) => {
              // Ensure base64 data is clean (no whitespace)
              const cleanData = img.data?.trim() || img.data;
              const imageUrl = `data:${img.mimeType};base64,${cleanData}`;

              return {
                type: 'image_url' as const,
                image_url: { url: imageUrl },
              };
            });

            // Ensure we have at least some text - Google Gemini may need non-empty text
            const queryText = state.currentQuery?.trim() || 'Please analyze the image(s) I uploaded.';

            const content = [
              // Text must come first for Google Gemini
              { type: 'text' as const, text: queryText },
              ...imageContents,
            ];

            console.log('📸 Created HumanMessage with content:', {
              textLength: content[0] && 'text' in content[0] ? content[0].text.length : 0,
              imageCount: imageContents.length,
            });

            return new HumanMessage({
              content,
              additional_kwargs: {
                timestamp,
              },
            });
          })()
        : new HumanMessage({
            content: state.currentQuery || '',
            additional_kwargs: {
              timestamp,
            },
          });

    langchainMessages.push(currentQueryMessage);
  }

  // Invoke LLM - ToolNode will handle tool execution automatically
  const response = await llm.invoke(langchainMessages);

  // Add timestamp to AI response
  const aiMessageWithTimestamp = new AIMessage({
    content: response.content,
    tool_calls: response.tool_calls,
    additional_kwargs: {
      ...response.additional_kwargs,
      timestamp: new Date().toISOString(),
    },
  });

  // Return the HumanMessage (for current query) + AIMessage (response)
  // Clear currentQuery after processing
  const messagesToAdd = currentQueryMessage ? [currentQueryMessage, aiMessageWithTimestamp] : [aiMessageWithTimestamp];

  return {
    messages: messagesToAdd, // Append HumanMessage + AIMessage to state (MessagesAnnotation handles merging)
    currentQuery: '', // Clear current query after processing
    currentQueryImages: [], // Clear images after processing
  };
}
