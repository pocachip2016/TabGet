# Backend 자율 큐레이션 에이전트 구현 플랜

## Context

TabGet 프론트엔드(`tabget-app/src/App.jsx`)는 현재 `VS_DATA` 하드코딩 mock으로 5개 VS 세트를 표시한다 (research.md §4, §16). 본 플랜은 research.md §18에 설계된 **자율 큐레이션 에이전트**를 실제로 구현하여, 실시간 트렌드 기반 Poll 세트를 자동 생성·공급하는 백엔드를 구축한다.

- **목적**: 고정 키워드 없이 SNS/뉴스/팝업 트렌드를 스카우트 → 20대 여성 타겟 상품 대결 Poll 5개 생성 → PostgreSQL 저장 → REST API로 프론트에 공급
- **스택**: Node.js + TypeScript / LangGraph / OpenAI GPT-4o / Serper / Prisma + PostgreSQL / Fastify / Docker Compose
- **범위**: Phase 1~3 (환경/스키마 → 에이전트 → 저장·API). Phase 4 n8n 스케줄링과 프론트 통합은 후속 작업.

## Directory Layout (신규)

루트에 `backend/` 서브프로젝트를 추가 (프론트 `tabget-app/`와 병렬).

```
TabGet/
├── tabget-app/                # (기존 frontend, 변경 없음)
└── backend/                   # ← 신규
    ├── docker-compose.yml
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    ├── prisma/
    │   └── schema.prisma
    └── src/
        ├── index.ts           # Fastify 엔트리
        ├── db.ts              # Prisma 싱글톤
        ├── agent/
        │   ├── curator.ts     # LangGraph 워크플로우
        │   ├── state.ts       # AgentState 타입
        │   └── nodes/
        │       ├── scout.ts
        │       ├── generate.ts
        │       └── curate.ts
        └── lib/
            └── serper.ts      # Serper API 래퍼
```

---

## Phase 1. Environment & Schema ✅

### 1.1 `backend/package.json`

```json
{
  "name": "tabget-backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/openai": "^0.3.0",
    "@prisma/client": "^5.20.0",
    "fastify": "^5.0.0",
    "zod": "^3.23.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "prisma": "^5.20.0",
    "@types/node": "^22.0.0"
  }
}
```

### 1.2 `backend/docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tabget
      POSTGRES_PASSWORD: tabget
      POSTGRES_DB: tabget
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  api:
    build: .
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql://tabget:tabget@db:5432/tabget
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SERPER_API_KEY: ${SERPER_API_KEY}
    ports: ["3000:3000"]

volumes:
  pgdata:
```

### 1.3 `backend/prisma/schema.prisma`

research.md §18.3 Poll 모델 + 투표 집계용 `Vote` 테이블(§18.7 5번 — 프론트 연결 전 필요).

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Poll {
  id           String   @id @default(uuid())
  category     String
  themeTitle   String
  productA     Json     // { brand, name, features, imageUrl, videoUrl }
  productB     Json
  curatorNote  String?
  status       String   @default("PENDING") // PENDING | ACTIVE | ARCHIVED
  scheduledAt  DateTime
  createdAt    DateTime @default(now())
  votes        Vote[]
}

model Vote {
  id       String   @id @default(uuid())
  pollId   String
  side     String   // "A" | "B"
  createdAt DateTime @default(now())
  poll     Poll     @relation(fields: [pollId], references: [id])
  @@index([pollId])
}

model TrendLog {
  id        String   @id @default(uuid())
  rawTrends String   @db.Text
  queries   Json
  createdAt DateTime @default(now())
}
```

### 1.4 `.env.example`

```
DATABASE_URL=postgresql://tabget:tabget@localhost:5432/tabget
OPENAI_API_KEY=sk-...
SERPER_API_KEY=...
PORT=3000
```

---

## Phase 2. Autonomous Scout Agent (LangGraph) ✅

### 2.1 `src/agent/state.ts`

```ts
export interface ProductPayload {
  brand: string;
  name: string;
  features: string[];
  imageUrl: string;
  videoUrl?: string;
}

export interface PollDraft {
  category: string;
  themeTitle: string;
  productA: ProductPayload;
  productB: ProductPayload;
  curatorNote?: string;
}

export interface AgentState {
  rawTrends: string;
  dynamicQueries: string[];
  finalJson: PollDraft[];
}
```

### 2.2 `src/lib/serper.ts`

```ts
export async function serperSearch(q: string): Promise<string> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q, gl: "kr", hl: "ko" }),
  });
  const json = await res.json();
  const items = (json.organic ?? []).slice(0, 8);
  return items.map((i: any) => `- ${i.title}: ${i.snippet}`).join("\n");
}
```

### 2.3 `src/agent/nodes/scout.ts`

```ts
import { serperSearch } from "../../lib/serper.js";
import type { AgentState } from "../state.js";

const SCOUT_QUERIES = [
  "오늘 한국 20대 여성 쇼핑 트렌드",
  "성수동 팝업스토어 최신 핫이슈",
  "인스타그램 20대 여성 뷰티 패션 바이럴",
];

export async function scoutNode(_: AgentState): Promise<Partial<AgentState>> {
  const results = await Promise.all(SCOUT_QUERIES.map(serperSearch));
  return { rawTrends: results.join("\n\n") };
}
```

### 2.4 `src/agent/nodes/generate.ts`

```ts
import { ChatOpenAI } from "@langchain/openai";
import type { AgentState } from "../state.js";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0.8 });

export async function generateNode(s: AgentState): Promise<Partial<AgentState>> {
  const prompt = `다음은 실시간 한국 트렌드이다:\n${s.rawTrends}\n\n` +
    `이 중 20대 여성 타겟 상품 "대결" 주제 5개를 도출하라. ` +
    `각 주제는 서로 다른 카테고리여야 하며, 양측 브랜드/상품명이 실재해야 한다. ` +
    `JSON 배열만 출력: [{"category","themeTitle","queryA","queryB"}]`;
  const out = await llm.invoke(prompt);
  const parsed = JSON.parse(extractJson(out.content as string));
  return { dynamicQueries: parsed };
}

function extractJson(s: string) {
  const m = s.match(/\[[\s\S]*\]/);
  return m ? m[0] : s;
}
```

### 2.5 `src/agent/nodes/curate.ts`

각 대결 후보에 대해 Serper로 이미지/상품 상세를 보강하고 최종 `PollDraft[]` JSON을 생성한다.

```ts
import { ChatOpenAI } from "@langchain/openai";
import { serperSearch } from "../../lib/serper.js";
import type { AgentState, PollDraft } from "../state.js";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0.3 });

export async function curateNode(s: AgentState): Promise<Partial<AgentState>> {
  const drafts: PollDraft[] = [];
  for (const q of s.dynamicQueries as any[]) {
    const [a, b] = await Promise.all([
      serperSearch(`${q.queryA} 공식 상품`),
      serperSearch(`${q.queryB} 공식 상품`),
    ]);
    const out = await llm.invoke(
      `다음 검색 결과로 상품 대결 JSON을 만들어라.\n` +
      `주제: ${q.themeTitle}\nA검색:\n${a}\nB검색:\n${b}\n\n` +
      `스키마: {category,themeTitle,curatorNote,` +
      `productA:{brand,name,features:[3],imageUrl,videoUrl?},productB:{...}}`
    );
    drafts.push(JSON.parse(extractJson(out.content as string)));
  }
  return { finalJson: drafts };
}

function extractJson(s: string) {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}
```

### 2.6 `src/agent/curator.ts`

```ts
import { StateGraph, END } from "@langchain/langgraph";
import type { AgentState } from "./state.js";
import { scoutNode } from "./nodes/scout.js";
import { generateNode } from "./nodes/generate.js";
import { curateNode } from "./nodes/curate.js";

const graph = new StateGraph<AgentState>({
  channels: {
    rawTrends: { value: (_, n) => n, default: () => "" },
    dynamicQueries: { value: (_, n) => n, default: () => [] },
    finalJson: { value: (_, n) => n, default: () => [] },
  },
})
  .addNode("scout", scoutNode)
  .addNode("generate", generateNode)
  .addNode("curate", curateNode)
  .addEdge("__start__", "scout")
  .addEdge("scout", "generate")
  .addEdge("generate", "curate")
  .addEdge("curate", END);

export const curationAgent = graph.compile();
```

---

## Phase 3. Persistence & REST API ✅

### 3.1 `src/db.ts`

```ts
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```

### 3.2 `src/index.ts`

```ts
import "dotenv/config";
import Fastify from "fastify";
import { prisma } from "./db.js";
import { curationAgent } from "./agent/curator.js";

const app = Fastify({ logger: true });

app.post("/run-curation", async (_, reply) => {
  try {
    const result = await curationAgent.invoke({
      rawTrends: "", dynamicQueries: [], finalJson: [],
    });
    const saved = await Promise.all(
      result.finalJson.map((d, i) =>
        prisma.poll.create({
          data: {
            category: d.category,
            themeTitle: d.themeTitle,
            productA: d.productA,
            productB: d.productB,
            curatorNote: d.curatorNote,
            status: "PENDING",
            scheduledAt: new Date(Date.now() + i * 60_000),
          },
        })
      )
    );
    await prisma.trendLog.create({
      data: { rawTrends: result.rawTrends, queries: result.dynamicQueries },
    });
    return { success: true, data: saved };
  } catch (e: any) {
    app.log.error(e);
    return reply.status(500).send({ success: false, error: e.message });
  }
});

app.get("/polls", async () => {
  return prisma.poll.findMany({
    where: { status: "ACTIVE" },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });
});

app.post<{ Params: { id: string }; Body: { side: "A" | "B" } }>(
  "/polls/:id/vote",
  async (req) => prisma.vote.create({
    data: { pollId: req.params.id, side: req.body.side },
  })
);

app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
```

### 3.3 이미지 URL 유효성 검증 (curateNode 후처리)

research.md §18.6 Phase 3 요구사항. `curate.ts`에서 draft 반환 전:

```ts
async function validateImage(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok && r.headers.get("content-type")?.startsWith("image/");
  } catch { return false; }
}
```

유효하지 않으면 Unsplash fallback URL로 치환하거나 해당 draft를 드롭.

---

## 프론트엔드 연결 (후속, 본 플랜 범위 밖이지만 참고)

`tabget-app/src/App.jsx`의 하드코딩 `VS_DATA`를 `useEffect(() => fetch("/polls"))` 로 교체. 필드 매핑은 research.md §18.3 표 참조:
- `itemA` ← `productA.name`, `imgA` ← `productA.imageUrl`
- `scheduledAt` → 카운트다운 `endTime` 계산

---

## Critical Files

| 신규 파일 | 역할 |
|-----------|------|
| `backend/prisma/schema.prisma` | Poll / Vote / TrendLog 모델 |
| `backend/src/agent/curator.ts` | LangGraph 워크플로우 컴파일 |
| `backend/src/agent/nodes/{scout,generate,curate}.ts` | 3개 에이전트 노드 |
| `backend/src/index.ts` | Fastify 서버 + API 3개 (`/run-curation`, `/polls`, `/polls/:id/vote`) |
| `backend/docker-compose.yml` | Postgres + API 컨테이너 |

## Verification

1. **환경 구동**
   ```bash
   cd backend && cp .env.example .env   # OPENAI/SERPER 키 채우기
   docker compose up -d db
   npm install && npx prisma migrate dev --name init
   npm run dev
   ```

2. **에이전트 실행**
   ```bash
   curl -X POST http://localhost:3000/run-curation
   ```
   - 응답 `{ success: true, data: [5개 Poll] }` 확인
   - `psql` 또는 `npx prisma studio` 로 `Poll` 레코드 5개, `TrendLog` 1개 확인

3. **공급 API**
   ```bash
   # 테스트용으로 레코드 status를 ACTIVE로 수동 업데이트 후
   curl http://localhost:3000/polls   # 5개 반환 확인
   curl -X POST http://localhost:3000/polls/<id>/vote -d '{"side":"A"}' -H 'content-type: application/json'
   ```

4. **스키마 매핑 검증**: 반환된 Poll의 `productA.imageUrl`이 유효한 이미지인지(HEAD 200), `features`가 배열 3개인지 확인.

5. **실패 케이스**: OPENAI 키 누락 시 `/run-curation`이 500 + 에러 메시지 반환하는지 확인.
