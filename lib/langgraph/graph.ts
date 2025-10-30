import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { loadCsvMetadataNode } from './nodes';
import { modelNode } from './nodes/model-node';
import { shouldContinue } from './nodes/should-continue';
import { csvTools } from './tools';
import { checkpointer } from './checkpointer';
import { CsvResourceMetadata } from './agent-state';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Define the state schema using Annotation
 * Uses MessagesAnnotation pattern for automatic LangChain message serialization
 */
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => {
      // MessagesAnnotation reducer: append new messages to existing ones
      return [...(x || []), ...(y || [])];
    },
    default: () => [],
  }),
  sessionId: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => '',
  }),
  csvResourcesMetadata: Annotation<CsvResourceMetadata[]>({
    reducer: (x: CsvResourceMetadata[], y: CsvResourceMetadata[]) => y ?? x,
    default: () => [],
  }),
  currentQuery: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => '',
  }),
  currentQueryImages: Annotation<Array<{ data: string; mimeType: string }>>({
    reducer: (x: Array<{ data: string; mimeType: string }>, y: Array<{ data: string; mimeType: string }> | undefined) => y ?? x,
    default: () => [],
  }),
});

/**
 * Initialize and return the LangGraph agent graph
 * Uses ToolNode for automatic tool execution and SqliteSaver for checkpointing
 */
export function initializeGraph() {
  const toolNode = new ToolNode(csvTools, {
    handleToolErrors: true,
  });

  return new StateGraph(StateAnnotation)
    .addNode('loadCsvMetadata', loadCsvMetadataNode)
    .addNode('model', modelNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'loadCsvMetadata')
    .addEdge('loadCsvMetadata', 'model')
    .addConditionalEdges('model', shouldContinue, {
      tools: 'tools',
      [END as string]: END, // Directly end - checkpointing handles persistence
    })
    .addEdge('tools', 'model') // Loop back to model after tools
    .compile({ checkpointer });
}
