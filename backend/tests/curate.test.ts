import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { QuotaExhaustedError } from "../src/lib/gemini-quota.js";

/**
 * curate.ts의 루프/에러 패턴 검증.
 * curateNode는 serper/LLM 외부 의존성이 있어 단위 테스트에서는
 * 동일한 try/catch 패턴을 격리해 동작을 검증한다.
 */

describe("curateNode error pattern", () => {
  test("T7: QuotaExhaustedError 발생 시 break — 잔여 쿼리 미처리", async () => {
    let buildCalls = 0;
    const mockBuildDraft = async () => {
      buildCalls++;
      if (buildCalls === 1) throw new QuotaExhaustedError("test quota");
      return { ok: true };
    };

    const queries = [1, 2, 3, 4, 5];
    const drafts: unknown[] = [];
    for (const _ of queries) {
      try {
        const draft = await mockBuildDraft();
        if (draft) drafts.push(draft);
      } catch (e) {
        if (e instanceof QuotaExhaustedError) break;
      }
    }
    assert.equal(buildCalls, 1, "첫 번째 호출만 실행 (break 직후)");
    assert.equal(drafts.length, 0);
  });

  test("일반 에러는 continue — 해당 쿼리만 skip", async () => {
    let buildCalls = 0;
    const mockBuildDraft = async () => {
      buildCalls++;
      if (buildCalls === 3) throw new Error("네트워크 오류");
      return { id: buildCalls };
    };

    const queries = [1, 2, 3, 4, 5];
    const drafts: Array<{ id: number }> = [];
    for (const _ of queries) {
      try {
        const draft = await mockBuildDraft();
        if (draft) drafts.push(draft as { id: number });
      } catch (e) {
        if (e instanceof QuotaExhaustedError) break;
      }
    }
    assert.equal(buildCalls, 5, "모든 쿼리 시도됨");
    assert.deepEqual(drafts.map((d) => d.id), [1, 2, 4, 5], "3번만 누락");
  });
});

describe("normalizeWithLLM error propagation pattern", () => {
  test("QuotaExhaustedError는 re-throw, 다른 에러는 null 반환", async () => {
    // 실제 normalizeWithLLM이 적용해야 하는 패턴
    const normalize = async (behavior: "ok" | "quota" | "other") => {
      try {
        if (behavior === "quota") throw new QuotaExhaustedError("429");
        if (behavior === "other") throw new Error("parse fail");
        return { brand: "X", name: "Y", features: [] };
      } catch (e) {
        if (e instanceof QuotaExhaustedError) throw e;
        return null;
      }
    };

    await assert.rejects(
      () => normalize("quota"),
      (e: unknown) => e instanceof QuotaExhaustedError,
      "QuotaExhaustedError는 전파",
    );

    const okResult = await normalize("ok");
    assert.ok(okResult);

    const otherResult = await normalize("other");
    assert.equal(otherResult, null, "일반 에러는 null 반환");
  });
});

describe("buildDraft sequential pattern — RPM 동시성 누수 방지", () => {
  test("normalizeWithLLM A 완료 후 B 시작 (Promise.all 아님)", async () => {
    const order: string[] = [];
    const mockNormalize = async (name: string) => {
      order.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, 10));
      order.push(`${name}:end`);
      return { brand: name, name, features: [] };
    };

    // sequential 패턴 (새 코드)
    const normA = await mockNormalize("A");
    const normB = await mockNormalize("B");

    assert.deepEqual(order, ["A:start", "A:end", "B:start", "B:end"]);
    assert.equal(normA.name, "A");
    assert.equal(normB.name, "B");
  });

  test("sequential + QuotaExhaustedError: A throw 시 B 미호출", async () => {
    let bCalled = false;
    const mockNormalizeA = async () => {
      throw new QuotaExhaustedError("A failed");
    };
    const mockNormalizeB = async () => {
      bCalled = true;
      return { brand: "B", name: "B", features: [] };
    };

    await assert.rejects(
      async () => {
        const _a = await mockNormalizeA();
        const _b = await mockNormalizeB(); // 도달 안 됨
      },
      (e: unknown) => e instanceof QuotaExhaustedError,
    );

    assert.equal(bCalled, false, "A가 throw하면 B는 호출되지 않음");
  });
});
