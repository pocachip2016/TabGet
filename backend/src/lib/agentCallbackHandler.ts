import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { LLMResult } from "@langchain/core/outputs";
import { agentLog } from "./logger.js";

/**
 * LangChain/LangGraph LLM 호출 수준의 로그를 agent.log에 기록.
 * 프롬프트 전문, 응답 전문, 토큰 사용량을 모두 포함.
 */
export class AgentCallbackHandler extends BaseCallbackHandler {
  name = "AgentCallbackHandler";

  private llmStartTimes = new Map<string, number>();
  private llmPrompts = new Map<string, string[]>();

  override handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string
  ): void {
    this.llmStartTimes.set(runId, Date.now());
    this.llmPrompts.set(runId, prompts);
    agentLog("INFO", "llm:start", {
      runId,
      provider: llm.id?.at(-1) ?? "unknown",
      prompts,
    });
  }

  override handleLLMEnd(output: LLMResult, runId: string): void {
    const durationMs = Date.now() - (this.llmStartTimes.get(runId) ?? Date.now());
    this.llmStartTimes.delete(runId);
    this.llmPrompts.delete(runId);

    const usage = output.llmOutput?.tokenUsage ?? output.llmOutput?.usage ?? undefined;

    // 각 generation의 텍스트 추출
    const responses = output.generations.map((gen) =>
      gen.map((g) => ("text" in g ? g.text : JSON.stringify(g))).join("")
    );

    agentLog("INFO", "llm:end", {
      runId,
      durationMs,
      responses,
      ...(usage ? { tokenUsage: usage } : {}),
    });
  }

  override handleLLMError(err: Error, runId: string): void {
    const durationMs = Date.now() - (this.llmStartTimes.get(runId) ?? Date.now());
    const prompts = this.llmPrompts.get(runId);
    this.llmStartTimes.delete(runId);
    this.llmPrompts.delete(runId);
    agentLog("ERROR", "llm:error", {
      runId,
      durationMs,
      error: err.message,
      ...(prompts ? { prompts } : {}),
    });
  }

  override handleChainStart(
    chain: Serialized,
    inputs: Record<string, unknown>,
    runId: string
  ): void {
    agentLog("INFO", "chain:start", {
      runId,
      name: chain.id?.at(-1) ?? "unknown",
      inputs,
    });
  }

  override handleChainEnd(outputs: Record<string, unknown>, runId: string): void {
    agentLog("INFO", "chain:end", { runId, outputs });
  }

  override handleChainError(err: Error, runId: string): void {
    agentLog("ERROR", "chain:error", { runId, error: err.message });
  }
}
