export type PersonaMode = 'COMPETE' | 'CHECK' | 'COVET';

export interface Bot {
  id: string;
  side: 'A' | 'B';
  authorName: string;
  persona: PersonaMode;
}

// 8 bots per side, fixed pool: COMPETE×3, CHECK×3, COVET×2
export const BOTS: Bot[] = [
  // Side A
  { id: 'a1', side: 'A', authorName: '갤럭시덕후', persona: 'COMPETE' },
  { id: 'a2', side: 'A', authorName: '가성비헌터', persona: 'COMPETE' },
  { id: 'a3', side: 'A', authorName: '스펙탐정', persona: 'COMPETE' },
  { id: 'a4', side: 'A', authorName: '실사용러', persona: 'CHECK' },
  { id: 'a5', side: 'A', authorName: '꼼꼼리뷰어', persona: 'CHECK' },
  { id: 'a6', side: 'A', authorName: '이성적소비자', persona: 'CHECK' },
  { id: 'a7', side: 'A', authorName: '아이폰찐팬', persona: 'COVET' },
  { id: 'a8', side: 'A', authorName: '테크얼리어답터', persona: 'COVET' },
  // Side B
  { id: 'b1', side: 'B', authorName: '삼성빠돌이', persona: 'COMPETE' },
  { id: 'b2', side: 'B', authorName: '최저가사냥꾼', persona: 'COMPETE' },
  { id: 'b3', side: 'B', authorName: '성능분석러', persona: 'COMPETE' },
  { id: 'b4', side: 'B', authorName: '한달사용후기', persona: 'CHECK' },
  { id: 'b5', side: 'B', authorName: '냉정한후기', persona: 'CHECK' },
  { id: 'b6', side: 'B', authorName: '합리소비연구소', persona: 'CHECK' },
  { id: 'b7', side: 'B', authorName: '갖고싶다갖고싶어', persona: 'COVET' },
  { id: 'b8', side: 'B', authorName: '위시리스트대장', persona: 'COVET' },
];

export function getBotsForSide(side: 'A' | 'B'): Bot[] {
  return BOTS.filter(b => b.side === side);
}

export function pickBot(side: 'A' | 'B', excludeId?: string): Bot {
  const pool = getBotsForSide(side).filter(b => b.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}
