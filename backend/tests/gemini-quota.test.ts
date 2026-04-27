import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GeminiRateLimiter,
  QuotaExhaustedError,
  __createLimiterForTest,
} from "../src/lib/gemini-quota.js";

// 단위 테스트용 임시 디렉터리와 usage 파일
let tmpDir: string;
let usageFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "gemini-quota-test-"));
  usageFile = join(tmpDir, "usage.json");
});

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

describe("GeminiRateLimiter", () => {
  test("T1: QUOTA_TABLE — gemini-2.5-flash은 실제 무료 티어 (rpd=20, rpm=5)", () => {
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.5-flash" });
    const s = limiter.status();
    assert.equal(s.limits.rpd, 20, "gemini-2.5-flash RPD는 20");
    assert.equal(s.limits.rpm, 5, "gemini-2.5-flash RPM은 5");
    assert.equal(s.limits.tpm, 250_000);
  });

  test("T1: QUOTA_TABLE — gemini-2.5-pro RPD=25", () => {
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.5-pro" });
    assert.equal(limiter.status().limits.rpd, 25);
  });

  test("T1: 미등록 모델은 보수적 한도 (rpd=20)", () => {
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-nonexistent" });
    const s = limiter.status();
    assert.equal(s.limits.rpd, 20, "CONSERVATIVE_LIMITS RPD=20");
    assert.equal(s.limits.rpm, 5);
  });

  test("T2: mutex — 10개 acquire 병렬 호출 시 rpdCount=10 (race 없음)", async () => {
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.0-flash" });
    const slots = await Promise.all(
      Array.from({ length: 10 }, () => limiter.acquire())
    );
    // 각 슬롯은 고유한 인덱스여야 함
    assert.equal(new Set(slots).size, 10, "모든 슬롯이 고유");
    // 파일의 rpdCount = 10
    const state = JSON.parse(readFileSync(usageFile, "utf-8"));
    assert.equal(state.rpdCount, 10);
    assert.equal(state.minuteWindow.length, 10);
  });

  test("T3: exhaustNow — 호출 후 acquire는 즉시 QuotaExhaustedError", async () => {
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.0-flash" });
    await limiter.acquire(); // 1건 사용
    limiter.exhaustNow();
    const s = limiter.status();
    assert.equal(s.remainingToday, 0);

    await assert.rejects(
      () => limiter.acquire(),
      (e) => {
        assert.ok(e instanceof QuotaExhaustedError);
        return true;
      }
    );
  });

  test("T4: record — 각 슬롯에 정확한 토큰 기록", async () => {
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.0-flash" });
    const slot0 = await limiter.acquire();
    const slot0Ts = Date.now();
    const slot1 = await limiter.acquire();
    const slot1Ts = Date.now();

    limiter.record(slot0, 100, slot0Ts);
    limiter.record(slot1, 200, slot1Ts);

    const state = JSON.parse(readFileSync(usageFile, "utf-8"));
    // ts 기반 매칭으로 각 슬롯이 올바른 토큰값
    const tokens = state.minuteWindow.map((e: { tokens: number }) => e.tokens);
    assert.deepEqual(tokens.sort(), [100, 200]);
  });

  test("RPD 한도 도달 시 즉시 throw", async () => {
    // rpd=20 상태를 파일에 직접 기록 (RPM wait 없이 빠르게 검증)
    const ptDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    await import("node:fs").then((fs) =>
      fs.writeFileSync(
        usageFile,
        JSON.stringify({ date: ptDate, rpdCount: 20, minuteWindow: [] }),
      ),
    );
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.5-flash" });
    await assert.rejects(
      () => limiter.acquire(),
      (e: unknown) => e instanceof QuotaExhaustedError,
    );
  });

  test("daily reset — 파일의 date가 과거이면 rpdCount=0으로 리셋", async () => {
    const yesterdayState = {
      date: "2020-01-01",
      rpdCount: 999,
      minuteWindow: [],
    };
    await import("node:fs").then((fs) =>
      fs.writeFileSync(usageFile, JSON.stringify(yesterdayState))
    );

    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.0-flash" });
    await limiter.acquire();
    const state = JSON.parse(readFileSync(usageFile, "utf-8"));
    assert.equal(state.rpdCount, 1, "리셋 후 1건만 사용");
  });

  test("status — remainingToday 정확도", async () => {
    const limiter = __createLimiterForTest({ usageFile, model: "gemini-2.5-flash" });
    await limiter.acquire();
    await limiter.acquire();
    const s = limiter.status();
    assert.equal(s.usage.rpdUsed, 2);
    assert.equal(s.remainingToday, 18); // 20 - 2
  });
});
