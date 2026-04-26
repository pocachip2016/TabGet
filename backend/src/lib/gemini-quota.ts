import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_USAGE_FILE = join(__dirname, "../../data/gemini-usage.json");
const DEFAULT_LOG_FILE = join(__dirname, "../../data/gemini.log");

// 실제 Google AI Studio 무료 티어 한도 (2025-04 기준)
// RPM = requests per minute, RPD = requests per day, TPM = tokens per minute
const QUOTA_TABLE: Record<string, { rpm: number; rpd: number; tpm: number }> = {
  "gemini-2.5-pro":        { rpm: 5,  rpd: 25,    tpm: 250_000 },
  "gemini-2.5-flash":      { rpm: 5,  rpd: 20,    tpm: 250_000 },
  "gemini-2.5-flash-lite": { rpm: 15, rpd: 1_000, tpm: 250_000 },
  "gemini-2.0-flash":      { rpm: 15, rpd: 200,   tpm: 1_000_000 },
};

const CONSERVATIVE_LIMITS = { rpm: 5, rpd: 20, tpm: 250_000 };

interface MinuteEntry {
  ts: number;
  count: number;
  tokens: number;
}

interface UsageState {
  date: string;
  rpdCount: number;
  minuteWindow: MinuteEntry[];
}

export interface QuotaStatus {
  model: string;
  limits: { rpm: number; rpd: number; tpm: number };
  usage: {
    rpdUsed: number;
    rpmCurrent: number;
    tpmCurrent: number;
  };
  remainingToday: number;
  tpmUtilization: number;
}

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

function getPTDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function geminiLog(level: "INFO" | "WARN" | "ERROR", event: string, payload?: unknown): void {
  if (process.env.GEMINI_LOG !== "true") return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(payload !== undefined ? { payload } : {}),
  };
  const line = JSON.stringify(entry);

  try {
    mkdirSync(dirname(DEFAULT_LOG_FILE), { recursive: true });
    appendFileSync(DEFAULT_LOG_FILE, line + "\n");
  } catch { /* 로그 실패는 무시 */ }

  console.log(`[gemini] ${entry.ts} ${level} | ${event}`, payload ?? "");
}

export class GeminiRateLimiter {
  private model: string;
  private limits: { rpm: number; rpd: number; tpm: number };
  private state: UsageState;
  private startTime: number;
  private usageFile: string;
  // 동시 호출을 직렬화하기 위한 Promise 체인 (mutex)
  private acquireChain: Promise<unknown> = Promise.resolve();

  constructor(opts?: { usageFile?: string; model?: string }) {
    this.model = opts?.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    this.limits = QUOTA_TABLE[this.model] ?? CONSERVATIVE_LIMITS;
    this.startTime = Date.now();
    this.usageFile = opts?.usageFile ?? DEFAULT_USAGE_FILE;

    if (!QUOTA_TABLE[this.model]) {
      geminiLog("WARN", "gemini:unknown-model", { model: this.model, usingLimits: CONSERVATIVE_LIMITS });
    }

    this.state = { date: getPTDate(), rpdCount: 0, minuteWindow: [] };
    this.load();

    geminiLog("INFO", "gemini:init", { model: this.model, limits: this.limits });
  }

  private load(): void {
    try {
      const raw = readFileSync(this.usageFile, "utf-8");
      this.state = JSON.parse(raw) as UsageState;
    } catch {
      this.state = { date: getPTDate(), rpdCount: 0, minuteWindow: [] };
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.usageFile), { recursive: true });
      writeFileSync(this.usageFile, JSON.stringify(this.state, null, 2));
    } catch { /* 저장 실패는 무시 */ }
  }

  private pruneMinuteWindow(now: number): void {
    this.state.minuteWindow = this.state.minuteWindow.filter(
      (e) => now - e.ts < 60_000
    );
  }

  /**
   * 쿼터 슬롯 획득. 동시 호출은 내부 Promise 체인으로 직렬화되어
   * race condition 없이 순차 처리된다.
   * @returns 기록된 minuteWindow entry index (record()에 전달)
   */
  async acquire(): Promise<number> {
    const prev = this.acquireChain;
    let release!: () => void;
    this.acquireChain = new Promise<void>((r) => (release = r));
    await prev.catch(() => undefined);
    try {
      return await this._acquireInner();
    } finally {
      release();
    }
  }

  private async _acquireInner(): Promise<number> {
    this.load();
    const now = Date.now();
    const today = getPTDate();

    if (this.state.date !== today) {
      const prev = this.state.date;
      const prevCount = this.state.rpdCount;
      this.state = { date: today, rpdCount: 0, minuteWindow: [] };
      this.save();
      geminiLog("INFO", "gemini:daily-reset", { previousDate: prev, newDate: today, previousRpdCount: prevCount });
    }

    this.pruneMinuteWindow(now);

    if (this.state.rpdCount >= this.limits.rpd) {
      geminiLog("ERROR", "gemini:acquire:rpd-exhausted", {
        rpdCount: this.state.rpdCount,
        rpdLimit: this.limits.rpd,
      });
      throw new QuotaExhaustedError(
        `RPD 한도 소진 (${this.state.rpdCount}/${this.limits.rpd}). PT 자정에 리셋됩니다.`
      );
    }

    const rpmCurrent = this.state.minuteWindow.length;
    if (rpmCurrent >= this.limits.rpm) {
      const oldestTs = this.state.minuteWindow[0].ts;
      const waitMs = 60_000 - (now - oldestTs);
      geminiLog("WARN", "gemini:acquire:rpm-wait", { rpmCurrent, waitMs });
      await sleep(Math.max(waitMs, 100));
      return this._acquireInner();
    }

    const tpmCurrent = this.state.minuteWindow.reduce((sum, e) => sum + e.tokens, 0);
    if (tpmCurrent >= this.limits.tpm * 0.9) {
      const oldestTs = this.state.minuteWindow[0].ts;
      const waitMs = 60_000 - (now - oldestTs);
      geminiLog("WARN", "gemini:acquire:tpm-wait", { tpmCurrent, tpmLimit: this.limits.tpm, waitMs });
      await sleep(Math.max(waitMs, 100));
      return this._acquireInner();
    }

    this.state.rpdCount++;
    this.state.minuteWindow.push({ ts: now, count: 1, tokens: 0 });
    const slotIndex = this.state.minuteWindow.length - 1;
    this.save();

    geminiLog("INFO", "gemini:acquire:ok", {
      rpdCount: this.state.rpdCount,
      rpmCurrent: this.state.minuteWindow.length,
      tpmCurrent,
      slotIndex,
    });

    return slotIndex;
  }

  /**
   * 특정 슬롯에 실제 토큰 사용량을 기록한다.
   * minuteWindow는 load/save 사이에 변경될 수 있으므로 ts 매칭으로 찾는다.
   */
  record(slotIndex: number, tokenCount: number, slotTs?: number): void {
    this.load();
    const window = this.state.minuteWindow;

    // slotTs가 있으면 ts 매칭으로 정확한 엔트리 찾기
    let target = -1;
    if (slotTs !== undefined) {
      target = window.findIndex((e) => e.ts === slotTs && e.tokens === 0);
    }
    if (target === -1 && slotIndex >= 0 && slotIndex < window.length) {
      target = slotIndex;
    }

    if (target >= 0 && target < window.length) {
      window[target].tokens = tokenCount;
    }
    this.save();

    const now = Date.now();
    this.pruneMinuteWindow(now);
    const tpmCurrent = this.state.minuteWindow.reduce((sum, e) => sum + e.tokens, 0);

    geminiLog("INFO", "gemini:record", {
      tokens: tokenCount,
      slotIndex: target,
      rpdCount: this.state.rpdCount,
      rpmCurrent: this.state.minuteWindow.length,
      tpmCurrent,
    });
  }

  /** 429 수신 시 즉시 일일 쿼터 소진 처리. 이후 acquire()는 모두 throw. */
  exhaustNow(): void {
    this.load();
    this.state.rpdCount = this.limits.rpd;
    this.save();
    geminiLog("WARN", "gemini:exhausted:forced", {
      rpdCount: this.state.rpdCount,
      rpdLimit: this.limits.rpd,
    });
  }

  status(): QuotaStatus {
    this.load();
    const now = Date.now();
    this.pruneMinuteWindow(now);

    const tpmCurrent = this.state.minuteWindow.reduce((sum, e) => sum + e.tokens, 0);
    return {
      model: this.model,
      limits: this.limits,
      usage: {
        rpdUsed: this.state.rpdCount,
        rpmCurrent: this.state.minuteWindow.length,
        tpmCurrent,
      },
      remainingToday: this.limits.rpd - this.state.rpdCount,
      tpmUtilization: tpmCurrent / this.limits.tpm,
    };
  }

  logShutdown(): void {
    geminiLog("INFO", "gemini:shutdown", {
      rpdUsed: this.state.rpdCount,
      uptimeMs: Date.now() - this.startTime,
    });
  }
}

export const geminiLimiter = new GeminiRateLimiter();

/** 테스트 전용: 임시 usage 파일로 새 limiter 인스턴스 생성 */
export function __createLimiterForTest(opts: { usageFile: string; model?: string }): GeminiRateLimiter {
  return new GeminiRateLimiter(opts);
}
