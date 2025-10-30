import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { loadCsvMetadataNode, agentNode, saveMessageNode } from './nodes';
import { CsvResourceMetadata } from './agent-state';
import { AgentMessage } from '@/lib/types/message';

/**
 * Define the state schema using Annotation
 */
const StateAnnotation = Annotation.Root({
  sessionId: Annotation<string>({
    reducer: (x: string, y: string) => y ?? x,
    default: () => '',
  }),
  messages: Annotation<AgentMessage[]>({
    reducer: (x: AgentMessage[], y: AgentMessage[]) => y ?? x,
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
    .addEdge(START, 'loadCsvMetadata')
    .addEdge('loadCsvMetadata', 'agent')
    .addEdge('agent', 'saveMessage')
    .addEdge('saveMessage', END)
    .compile();
}
