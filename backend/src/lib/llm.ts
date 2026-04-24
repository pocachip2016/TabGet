import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import type { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { geminiLimiter, geminiLog, QuotaExhaustedError } from "./gemini-quota.js";

export { QuotaExhaustedError } from "./gemini-quota.js";

type LLMProvider = "openai" | "ollama" | "gemini";

function getProvider(): LLMProvider {
  const raw = process.env.LLM_PROVIDER ?? "ollama";
  if (raw === "openai" || raw === "ollama" || raw === "gemini") return raw;
  throw new Error(
    `Unknown LLM_PROVIDER="${raw}". Must be "openai" | "ollama" | "gemini".`
  );
}

export function createLLM(temperature: number): BaseChatModel {
  const provider = getProvider();

  switch (provider) {
    case "ollama":
      return new ChatOllama({
        model: process.env.OLLAMA_MODEL ?? "qwen2.5:7b",
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        temperature,
      });

    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
      }
      const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      return new ChatGoogleGenerativeAI({ model, apiKey, temperature });
    }

    default: // "openai"
      return new ChatOpenAI({ model: "gpt-4o", temperature });
  }
}

function estimateTokens(content: unknown): number {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4);
}

/** Gemini API가 쿼터/레이트리밋 초과를 알릴 때의 에러 시그니처를 감지 */
export function isQuotaExhaustedError(e: unknown): boolean {
  if (e instanceof QuotaExhaustedError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  // Google GenAI: "[GoogleGenerativeAI Error]: ... 429 Too Many Requests ... RESOURCE_EXHAUSTED"
  return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(msg);
}

export async function rateLimitedInvoke(
  llm: BaseChatModel,
  messages: BaseMessage[]
): Promise<AIMessageChunk> {
  // Gemini가 아닌 provider는 Gemini limiter를 건너뛴다 (카운트 오염 방지)
  if (getProvider() !== "gemini") {
    return (await llm.invoke(messages)) as AIMessageChunk;
  }

  const slotIndex = await geminiLimiter.acquire();
  const slotTs = Date.now();

  const promptText = messages.map((m) => String(m.content)).join("\n");
  geminiLog("INFO", "gemini:api:call", {
    prompt: promptText.slice(0, 200),
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    slotIndex,
  });

  const start = Date.now();
  try {
    const result = await llm.invoke(messages);
    const tokens =
      (result as AIMessageChunk).usage_metadata?.total_tokens ??
      estimateTokens(result.content);
    geminiLog("INFO", "gemini:api:response", {
      tokens,
      durationMs: Date.now() - start,
      response: String(result.content).slice(0, 200),
    });
    geminiLimiter.record(slotIndex, tokens, slotTs);
    return result as AIMessageChunk;
  } catch (e) {
    geminiLog("ERROR", "gemini:api:error", {
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - start,
    });
    if (isQuotaExhaustedError(e)) {
      geminiLimiter.exhaustNow();
      throw new QuotaExhaustedError(
        `Gemini API 429 — 무료 쿼터 소진 (원인: ${e instanceof Error ? e.message : String(e)})`
      );
    }
    throw e;
  }
}
