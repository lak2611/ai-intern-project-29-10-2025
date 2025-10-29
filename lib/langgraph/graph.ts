import { StateGraph, Annotation } from '@langchain/langgraph';
import { loadCsvMetadataNode, agentNode, saveMessageNode } from './nodes';
import { CsvResourceMetadata, Message } from './agent-state';

/**
 * Define the state schema using Annotation
 */
const StateAnnotation = Annotation.Root({
  sessionId: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => '',
  }),
  messages: Annotation<Message[]>({
    reducer: (x: Message[], y: Message[]) => y ?? x,
    default: () => [],
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
 */
export function initializeGraph() {
  return new StateGraph(StateAnnotation)
    .addNode('loadCsvMetadata', loadCsvMetadataNode)
    .addNode('agent', agentNode)
    .addNode('saveMessage', saveMessageNode)
    .addEdge('__start__', 'loadCsvMetadata')
    .addEdge('loadCsvMetadata', 'agent')
    .addEdge('agent', 'saveMessage')
    .addEdge('saveMessage', '__end__')
    .compile();
}
