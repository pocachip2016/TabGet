import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const USAGE_FILE = join(DATA_DIR, "gemini-usage.json");
const GEMINI_LOG_FILE = join(DATA_DIR, "gemini.log");

const QUOTA_TABLE: Record<string, { rpm: number; rpd: number; tpm: number }> = {
  "gemini-2.5-pro":        { rpm: 5,  rpd: 100,   tpm: 250_000 },
  "gemini-2.5-flash":      { rpm: 10, rpd: 250,   tpm: 250_000 },
  "gemini-2.5-flash-lite": { rpm: 15, rpd: 1_000, tpm: 250_000 },
  "gemini-2.0-flash":      { rpm: 5,  rpd: 200,   tpm: 250_000 },
};

const CONSERVATIVE_LIMITS = { rpm: 5, rpd: 100, tpm: 250_000 };

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
    mkdirSync(dirname(GEMINI_LOG_FILE), { recursive: true });
    appendFileSync(GEMINI_LOG_FILE, line + "\n");
  } catch { /* 로그 실패는 무시 */ }

  console.log(`[gemini] ${entry.ts} ${level} | ${event}`, payload ?? "");
}

export class GeminiRateLimiter {
  private model: string;
  private limits: { rpm: number; rpd: number; tpm: number };
  private state: UsageState;
  private startTime: number;

  constructor() {
    this.model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    this.limits = QUOTA_TABLE[this.model] ?? CONSERVATIVE_LIMITS;
    this.startTime = Date.now();

    if (!QUOTA_TABLE[this.model]) {
      geminiLog("WARN", "gemini:unknown-model", { model: this.model, usingLimits: CONSERVATIVE_LIMITS });
    }

    this.state = { date: getPTDate(), rpdCount: 0, minuteWindow: [] };
    this.load();

    geminiLog("INFO", "gemini:init", { model: this.model, limits: this.limits });
  }

  private load(): void {
    try {
      const raw = readFileSync(USAGE_FILE, "utf-8");
      this.state = JSON.parse(raw) as UsageState;
    } catch {
      this.state = { date: getPTDate(), rpdCount: 0, minuteWindow: [] };
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(USAGE_FILE), { recursive: true });
      writeFileSync(USAGE_FILE, JSON.stringify(this.state, null, 2));
    } catch { /* 저장 실패는 무시 */ }
  }

  private pruneMinuteWindow(now: number): void {
    this.state.minuteWindow = this.state.minuteWindow.filter(
      (e) => now - e.ts < 60_000
    );
  }

  async acquire(): Promise<void> {
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
      return this.acquire();
    }

    const tpmCurrent = this.state.minuteWindow.reduce((sum, e) => sum + e.tokens, 0);
    if (tpmCurrent >= this.limits.tpm * 0.9) {
      const oldestTs = this.state.minuteWindow[0].ts;
      const waitMs = 60_000 - (now - oldestTs);
      geminiLog("WARN", "gemini:acquire:tpm-wait", { tpmCurrent, tpmLimit: this.limits.tpm, waitMs });
      await sleep(Math.max(waitMs, 100));
      return this.acquire();
    }

    this.state.rpdCount++;
    this.state.minuteWindow.push({ ts: now, count: 1, tokens: 0 });
    this.save();

    geminiLog("INFO", "gemini:acquire:ok", {
      rpdCount: this.state.rpdCount,
      rpmCurrent: this.state.minuteWindow.length,
      tpmCurrent,
    });
  }

  record(tokenCount: number): void {
    this.load();
    const window = this.state.minuteWindow;
    if (window.length > 0) {
      window[window.length - 1].tokens = tokenCount;
    }
    this.save();

    const now = Date.now();
    this.pruneMinuteWindow(now);
    const tpmCurrent = this.state.minuteWindow.reduce((sum, e) => sum + e.tokens, 0);

    geminiLog("INFO", "gemini:record", {
      tokens: tokenCount,
      rpdCount: this.state.rpdCount,
      rpmCurrent: this.state.minuteWindow.length,
      tpmCurrent,
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
