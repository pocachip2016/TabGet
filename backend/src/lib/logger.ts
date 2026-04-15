import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const LOG_FILE = join(__dirname, "../../data/agent.log");

type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  event: string;
  payload?: unknown;
}

export function agentLog(level: LogLevel, event: string, payload?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(payload !== undefined ? { payload } : {}),
  };
  const line = JSON.stringify(entry);

  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // 로그 실패는 에이전트 동작에 영향 없음
  }

  // 콘솔에도 출력 (개발 편의)
  const prefix = `[agent] ${entry.ts} ${level}`;
  if (payload !== undefined) {
    console.log(`${prefix} | ${event}`, payload);
  } else {
    console.log(`${prefix} | ${event}`);
  }
}
