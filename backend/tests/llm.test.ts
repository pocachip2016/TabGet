import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIMessageChunk } from "@langchain/core/messages";
import { isQuotaExhaustedError, QuotaExhaustedError } from "../src/lib/llm.js";

describe("isQuotaExhaustedError", () => {
  test("QuotaExhaustedError 인스턴스를 인식", () => {
    assert.equal(
      isQuotaExhaustedError(new QuotaExhaustedError("test")),
      true,
    );
  });

  test("'429' 포함 메시지 인식", () => {
    assert.equal(
      isQuotaExhaustedError(new Error("Got 429 Too Many Requests")),
      true,
    );
  });

  test("'RESOURCE_EXHAUSTED' 인식 (Gemini gRPC 스타일)", () => {
    assert.equal(
      isQuotaExhaustedError(new Error("[GoogleGenerativeAI Error]: RESOURCE_EXHAUSTED quota exceeded")),
      true,
    );
  });

  test("'quota' 키워드 인식", () => {
    assert.equal(
      isQuotaExhaustedError(new Error("Daily quota limit reached for model")),
      true,
    );
  });

  test("일반 에러는 false", () => {
    assert.equal(isQuotaExhaustedError(new Error("network timeout")), false);
    assert.equal(isQuotaExhaustedError(new Error("parse error")), false);
  });

  test("string 에러도 처리", () => {
    assert.equal(isQuotaExhaustedError("HTTP 429"), true);
    assert.equal(isQuotaExhaustedError("ok"), false);
  });
});

describe("rateLimitedInvoke — provider 가드 + 429 통합", () => {
  let tmpDir: string;
  let backupUsageFile: string;
  const realUsageFile = join(import.meta.dirname ?? __dirname, "../data/gemini-usage.json");

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "llm-test-"));
    backupUsageFile = join(tmpDir, "backup.json");
    if (existsSync(realUsageFile)) {
      writeFileSync(backupUsageFile, readFileSync(realUsageFile));
    }
    // 테스트 환경 격리: 싱글톤 파일 초기화
    writeFileSync(
      realUsageFile,
      JSON.stringify({ date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }), rpdCount: 0, minuteWindow: [] }, null, 2),
    );
  });

  afterEach(() => {
    // 원본 복구
    if (existsSync(backupUsageFile)) {
      writeFileSync(realUsageFile, readFileSync(backupUsageFile));
    }
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeMockLLM(behavior: "ok" | "429" | "other"): BaseChatModel {
    return {
      invoke: async (): Promise<AIMessageChunk> => {
        if (behavior === "ok") {
          return {
            content: '{"brand":"Test","name":"Model","features":["a","b","c"]}',
            usage_metadata: { total_tokens: 50 },
          } as unknown as AIMessageChunk;
        }
        if (behavior === "429") {
          throw new Error("[GoogleGenerativeAI Error]: 429 Too Many Requests. RESOURCE_EXHAUSTED");
        }
        throw new Error("Some other network error");
      },
    } as unknown as BaseChatModel;
  }

  test("provider=ollama 이면 limiter를 건너뛰고 그대로 호출", async (t) => {
    const prevProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "ollama";
    t.after(() => {
      if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = prevProvider;
    });

    const { rateLimitedInvoke } = await import("../src/lib/llm.js");
    const { geminiLimiter } = await import("../src/lib/gemini-quota.js");
    const before = geminiLimiter.status().usage.rpdUsed;

    const result = await rateLimitedInvoke(makeMockLLM("ok"), []);
    assert.ok(String(result.content).includes("Test"));

    const after = geminiLimiter.status().usage.rpdUsed;
    assert.equal(after, before, "ollama 호출은 rpdCount를 증가시키지 않음");
  });

  test("T5: provider=gemini + 429 응답 → QuotaExhaustedError 발생 + exhaustNow 효과", async (t) => {
    const prevProvider = process.env.LLM_PROVIDER;
    const prevModel = process.env.GEMINI_MODEL;
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.GEMINI_API_KEY = "test-key";
    t.after(() => {
      if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = prevProvider;
      if (prevModel === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = prevModel;
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
    });

    const { rateLimitedInvoke } = await import("../src/lib/llm.js");
    const { geminiLimiter } = await import("../src/lib/gemini-quota.js");

    await assert.rejects(
      () => rateLimitedInvoke(makeMockLLM("429"), []),
      (e: unknown) => e instanceof QuotaExhaustedError,
    );

    const status = geminiLimiter.status();
    assert.equal(status.remainingToday, 0, "exhaustNow로 remainingToday=0");
  });

  test("provider=gemini 정상 응답 → 토큰 기록됨", async (t) => {
    const prevProvider = process.env.LLM_PROVIDER;
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    t.after(() => {
      if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = prevProvider;
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
    });

    const { rateLimitedInvoke } = await import("../src/lib/llm.js");
    const { geminiLimiter } = await import("../src/lib/gemini-quota.js");

    const result = await rateLimitedInvoke(makeMockLLM("ok"), []);
    assert.ok(String(result.content).includes("Test"));

    const state = JSON.parse(readFileSync(realUsageFile, "utf-8"));
    assert.equal(state.rpdCount, 1);
    // 해당 슬롯의 토큰이 기록됨
    const tokens = state.minuteWindow.reduce((s: number, e: { tokens: number }) => s + e.tokens, 0);
    assert.equal(tokens, 50);
  });

  test("provider=gemini + 일반 에러는 exhaustNow 미호출, 에러 그대로 rethrow", async (t) => {
    const prevProvider = process.env.LLM_PROVIDER;
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    t.after(() => {
      if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = prevProvider;
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
    });

    const { rateLimitedInvoke } = await import("../src/lib/llm.js");
    const { geminiLimiter } = await import("../src/lib/gemini-quota.js");

    await assert.rejects(
      () => rateLimitedInvoke(makeMockLLM("other"), []),
      (e: unknown) => {
        assert.ok(!(e instanceof QuotaExhaustedError));
        return true;
      },
    );

    const status = geminiLimiter.status();
    assert.ok(status.remainingToday > 0, "일반 에러는 쿼터 소진하지 않음");
  });
});
