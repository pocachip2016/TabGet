import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import type { QueryCandidate, PollDraft } from "./state.js";
import { scoutNode } from "./nodes/scout.js";
import { generateNode } from "./nodes/generate.js";
import { curateNode } from "./nodes/curate.js";
import { agentLog } from "../lib/logger.js";
import type { AgentState } from "./state.js";

const AgentAnnotation = Annotation.Root({
  rawTrends: Annotation<string>({
    reducer: (_: string, n: string) => n,
    default: () => "",
  }),
  dynamicQueries: Annotation<QueryCandidate[]>({
    reducer: (_: QueryCandidate[], n: QueryCandidate[]) => n,
    default: () => [],
  }),
  finalJson: Annotation<PollDraft[]>({
    reducer: (_: PollDraft[], n: PollDraft[]) => n,
    default: () => [],
  }),
});

export type AgentAnnotationState = typeof AgentAnnotation.State;

/** 노드 함수를 래핑해 입력 state 전문 + 결과값 전문을 agent.log에 기록 */
function withNodeLogging<S extends AgentState>(
  name: string,
  fn: (state: S) => Promise<Partial<AgentState>>
): (state: S) => Promise<Partial<AgentState>> {
  return async (state: S) => {
    const start = Date.now();
    agentLog("INFO", `node:${name}:call`, { state });
    try {
      const result = await fn(state);
      agentLog("INFO", `node:${name}:callback`, {
        durationMs: Date.now() - start,
        result,
      });
      return result;
    } catch (e) {
      agentLog("ERROR", `node:${name}:error`, {
        durationMs: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      throw e;
    }
  };
}

const graph = new StateGraph(AgentAnnotation)
  .addNode("scout", withNodeLogging("scout", scoutNode))
  .addNode("generate", withNodeLogging("generate", generateNode))
  .addNode("curate", withNodeLogging("curate", curateNode))
  .addEdge(START, "scout")
  .addEdge("scout", "generate")
  .addEdge("generate", "curate")
  .addEdge("curate", END);

export const curationAgent = graph.compile();
