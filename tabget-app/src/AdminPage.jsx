import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Play, CheckCircle, Clock, Archive, AlertCircle, X } from 'lucide-react';
import { fetchAdminPolls, patchPollStatus, fetchTrendLogs, runCuration, activateAllPending } from './api/client';

const STATUS_OPTIONS = ['ALL', 'PENDING', 'ACTIVE', 'ARCHIVED'];

const STATUS_STYLE = {
  PENDING:  { bg: 'bg-yellow-500/20', text: 'text-yellow-300', icon: Clock },
  ACTIVE:   { bg: 'bg-green-500/20',  text: 'text-green-300',  icon: CheckCircle },
  ARCHIVED: { bg: 'bg-zinc-500/20',   text: 'text-zinc-400',   icon: Archive },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: AlertCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      <Icon size={10} /> {status}
    </span>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-white/20 transition"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-xs text-white/60">{page} / {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-white/20 transition"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function ProductImage({ url, name }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="absolute inset-0 bg-zinc-800 flex flex-col items-center justify-center gap-1 text-zinc-500">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span className="text-[9px] text-center px-2 line-clamp-2">{name}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      className="absolute inset-0 w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function PollCard({ poll, onStatusChange }) {
  const a = poll.productA ?? {};
  const b = poll.productB ?? {};
  const total = poll.votesA + poll.votesB;
  const pctA = total > 0 ? Math.round((poll.votesA / total) * 100) : 50;
  const pctB = 100 - pctA;
  const [changing, setChanging] = useState(false);

  const nextStatus = poll.status === 'PENDING' ? 'ACTIVE'
    : poll.status === 'ACTIVE' ? 'ARCHIVED'
    : 'PENDING';

  const handleStatusClick = async () => {
    setChanging(true);
    try { await onStatusChange(poll.id, nextStatus); }
    finally { setChanging(false); }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Images + status button overlay */}
      <div className="flex h-32 relative">
        <div className="relative flex-1 overflow-hidden">
          <ProductImage url={a.imageUrl} name={a.name} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <p className="absolute bottom-2 left-2 text-white text-xs font-bold truncate right-2 drop-shadow">{a.name}</p>
        </div>
        <div className="w-px bg-white/10" />
        <div className="relative flex-1 overflow-hidden">
          <ProductImage url={b.imageUrl} name={b.name} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <p className="absolute bottom-2 left-2 text-white text-xs font-bold truncate right-2 drop-shadow">{b.name}</p>
        </div>
        {/* Status button — top right */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <StatusBadge status={poll.status} />
          <button
            onClick={handleStatusClick}
            disabled={changing}
            className="text-[10px] px-2 py-0.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 font-bold transition disabled:opacity-40 backdrop-blur-sm"
          >
            {changing ? '...' : `→ ${nextStatus}`}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="min-w-0">
          <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider">{poll.category}</p>
          <p className="text-sm text-white font-semibold leading-snug truncate">{poll.themeTitle}</p>
        </div>

        {/* Vote bar */}
        <div>
          <div className="flex justify-between text-[10px] text-white/50 mb-1">
            <span>{poll.votesA.toLocaleString()} ({pctA}%)</span>
            <span>{poll.votesB.toLocaleString()} ({pctB}%)</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-white/10">
            <div className="bg-blue-400 transition-all duration-300" style={{ width: `${pctA}%` }} />
            <div className="bg-pink-400 transition-all duration-300" style={{ width: `${pctB}%` }} />
          </div>
          <p className="text-[9px] text-white/30 mt-1">{total.toLocaleString()}명 참여</p>
        </div>

        {poll.curatorNote && (
          <p className="text-[10px] text-white/50 italic line-clamp-2">"{poll.curatorNote}"</p>
        )}

        <p className="text-[9px] text-white/30">
          {new Date(poll.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </p>
      </div>
    </div>
  );
}

// 날짜 문자열 (YYYY-MM-DD KST)
function toDateKey(isoStr) {
  return new Date(isoStr).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// 시간 문자열 (HH:MM:SS KST)
function toTimeStr(isoStr) {
  return new Date(isoStr).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

const CATEGORY_COLOR = {
  '럭셔리 시계':    'bg-amber-500/20 text-amber-300',
  '프리미엄 자동차':'bg-blue-500/20 text-blue-300',
  '하이엔드 스니커즈':'bg-purple-500/20 text-purple-300',
  '프리미엄 가전':  'bg-cyan-500/20 text-cyan-300',
  '럭셔리 주얼리':  'bg-pink-500/20 text-pink-300',
  '프리미엄 오디오':'bg-green-500/20 text-green-300',
  '명품 가방':      'bg-rose-500/20 text-rose-300',
};

function RunCard({ log, runIndex, totalRuns, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const queries = Array.isArray(log.queries) ? log.queries : [];
  const runNo = totalRuns - runIndex;

  return (
    <div className={`border rounded-xl overflow-hidden transition ${selected ? 'border-pink-500/60 bg-pink-500/5' : 'border-white/10 bg-white/5'}`}>
      {/* Header row */}
      <div className="flex items-center">
        {/* Run number — click to select/deselect */}
        <button
          onClick={() => onSelect(selected ? null : log)}
          className={`shrink-0 w-10 h-10 flex items-center justify-center text-[11px] font-black transition ${selected ? 'text-pink-400' : 'text-white/40 hover:text-white/70'}`}
        >
          #{runNo}
        </button>
        <button
          className="flex-1 flex items-center justify-between px-2 py-2.5 text-left hover:bg-white/5 transition"
          onClick={() => setExpanded(v => !v)}
        >
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">
            #{runNo}
          </span>
          <span className="text-xs text-white/70 font-medium shrink-0">{toTimeStr(log.createdAt)}</span>
          <span className="text-[10px] text-white/30 shrink-0">· {queries.length}개</span>
        </div>
        <span className="text-[10px] text-white/40 ml-2">{expanded ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Category tags (always visible) */}
      {queries.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {queries.map((q, i) => {
            const cat = typeof q === 'object' ? (q.category ?? '') : '';
            const cls = CATEGORY_COLOR[cat] ?? 'bg-white/10 text-white/50';
            return (
              <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
                {cat || q}
              </span>
            );
          })}
        </div>
      )}

      {/* Expanded: query detail */}
      {expanded && queries.length > 0 && (
        <div className="border-t border-white/10 divide-y divide-white/5">
          {queries.map((q, i) => (
            <div key={i} className="px-3 py-2 space-y-0.5">
              <p className="text-[11px] text-white/80 font-semibold leading-snug">
                {typeof q === 'object' ? q.themeTitle : q}
              </p>
              {typeof q === 'object' && (
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-[9px] text-white/40">
                    <span className="text-blue-400 font-bold">A</span> {q.queryA}
                  </p>
                  <p className="text-[9px] text-white/40">
                    <span className="text-pink-400 font-bold">B</span> {q.queryB}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogsByRun({ logs, selectedRun, onSelect }) {
  return (
    <div className="space-y-2">
      {logs.map((log, i) => (
        <RunCard key={log.id} log={log} runIndex={i} totalRuns={logs.length}
          selected={selectedRun?.id === log.id} onSelect={onSelect} />
      ))}
    </div>
  );
}

function LogsByDate({ logs, selectedRun, onSelect }) {
  const groups = [];
  const seen = new Map();
  for (const log of logs) {
    const dk = toDateKey(log.createdAt);
    if (!seen.has(dk)) { seen.set(dk, []); groups.push({ date: dk, items: seen.get(dk) }); }
    seen.get(dk).push(log);
  }

  return (
    <div className="space-y-4">
      {groups.map(({ date, items }) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{date}</span>
            <span className="text-[9px] text-white/30">· {items.length}회 실행</span>
            <div className="flex-1 border-t border-white/10" />
          </div>
          <div className="space-y-2 pl-1">
            {items.map((log, i) => (
              <RunCard key={log.id} log={log} runIndex={i} totalRuns={items.length}
                selected={selectedRun?.id === log.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  // Polls state
  const [pollData, setPollData] = useState({ polls: [], total: 0, page: 1, totalPages: 1 });
  const [pollPage, setPollPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pollLoading, setPollLoading] = useState(false);
  const [pollError, setPollError] = useState(null);

  // Trend logs state
  const [logData, setLogData] = useState({ logs: [], total: 0, page: 1, totalPages: 1 });
  const [logPage, setLogPage] = useState(1);
  const [logLoading, setLogLoading] = useState(false);
  const [logView, setLogView] = useState('date'); // 'date' | 'run'
  const [selectedRun, setSelectedRun] = useState(null); // TrendLog | null

  // Curation
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [activating, setActivating] = useState(false);

  const loadPolls = useCallback(async (page, status, run = null) => {
    setPollLoading(true);
    setPollError(null);
    try {
      const data = await fetchAdminPolls({ page, limit: 10, status, runAt: run?.createdAt ?? null });
      setPollData(data);
    } catch (e) {
      setPollError(e.message);
    } finally {
      setPollLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (page) => {
    setLogLoading(true);
    try {
      const data = await fetchTrendLogs({ page, limit: 20 });
      setLogData(data);
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => { loadPolls(pollPage, statusFilter, selectedRun); }, [pollPage, statusFilter, selectedRun, loadPolls]);
  useEffect(() => { loadLogs(logPage); }, [logPage, loadLogs]);

  const handleStatusChange = async (pollId, newStatus) => {
    await patchPollStatus(pollId, newStatus);
    loadPolls(pollPage, statusFilter, selectedRun);
  };

  const handleSelectRun = (run) => {
    setSelectedRun(run);
    setPollPage(1);
  };

  const handleActivateAll = async () => {
    setActivating(true);
    try {
      const res = await activateAllPending();
      setRunResult({ ok: true, count: res.updated, msg: 'PENDING → ACTIVE' });
      loadPolls(1, statusFilter, selectedRun);
      setPollPage(1);
    } catch (e) {
      setRunResult({ ok: false, msg: e.message });
    } finally {
      setActivating(false);
    }
  };

  const handleRunCuration = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await runCuration();
      setRunResult({ ok: true, count: Array.isArray(res.data) ? res.data.length : '?' });
      loadPolls(1, statusFilter);
      setPollPage(1);
      loadLogs(1);
      setLogPage(1);
    } catch (e) {
      setRunResult({ ok: false, msg: e.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="#" className="text-white/50 hover:text-white transition">
            <X size={18} />
          </a>
          <h1 className="text-base font-black">
            <span className="text-white">Tap</span>
            <span style={{ color: '#E30B5C' }}>Get</span>
            <span className="text-white/40 text-sm font-normal ml-1.5">관리자</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleActivateAll}
            disabled={activating}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-green-600/80 hover:bg-green-500/80 text-white transition-all active:scale-95 disabled:opacity-40"
          >
            <CheckCircle size={12} />
            {activating ? '...' : 'ACTIVE 전환'}
          </button>
          <button
            onClick={handleRunCuration}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={{ background: running ? '#555' : 'linear-gradient(135deg,#E30B5C,#c4084e)' }}
          >
            {running ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? '실행 중...' : '에이전트 실행'}
          </button>
        </div>
      </div>

      {/* Run result toast */}
      {runResult && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-bold ${runResult.ok ? 'bg-green-600/20 text-green-300' : 'bg-red-600/20 text-red-300'}`}>
          {runResult.ok ? `✓ ${runResult.count}개 Poll 생성 완료` : `✗ 실패: ${runResult.msg}`}
          <button onClick={() => setRunResult(null)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {/* Trend Logs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white/80">
              에이전트 실행 기록 <span className="text-white/40 font-normal">({logData.total}회)</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                {[{ key: 'date', label: '날짜별' }, { key: 'run', label: '실행별' }].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setLogView(key)}
                    className={`px-2 py-0.5 text-[10px] font-bold transition ${logView === key ? 'bg-white text-black' : 'bg-transparent text-white/50 hover:text-white/80'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadLogs(logPage)}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <RefreshCw size={11} />
              </button>
            </div>
          </div>
          {logLoading && (
            <div className="text-center py-6 text-white/40 text-sm">불러오는 중...</div>
          )}
          {!logLoading && logData.logs.length === 0 && (
            <div className="text-center py-6 text-white/30 text-sm">실행 기록이 없습니다</div>
          )}
          {!logLoading && logData.logs.length > 0 && (
            logView === 'date'
              ? <LogsByDate logs={logData.logs} selectedRun={selectedRun} onSelect={handleSelectRun} />
              : <LogsByRun logs={logData.logs} selectedRun={selectedRun} onSelect={handleSelectRun} />
          )}
          <Pagination page={logData.page} totalPages={logData.totalPages} onPage={setLogPage} />
        </section>

        {/* Poll List */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-bold text-white/80 shrink-0">
                Poll 목록 <span className="text-white/40 font-normal">({pollData.total}개)</span>
              </h2>
              {selectedRun && (
                <button
                  onClick={() => handleSelectRun(null)}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition shrink-0"
                >
                  #{logData.logs.length - logData.logs.findIndex(l => l.id === selectedRun.id)} 실행 <X size={9} />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPollPage(1); }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${statusFilter === s ? 'bg-white text-black' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => loadPolls(pollPage, statusFilter)}
                className="ml-1 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <RefreshCw size={11} />
              </button>
            </div>
          </div>

          {pollLoading && (
            <div className="text-center py-10 text-white/40 text-sm">불러오는 중...</div>
          )}
          {pollError && (
            <div className="text-center py-6 text-red-400 text-xs">{pollError}</div>
          )}
          {!pollLoading && !pollError && pollData.polls.length === 0 && (
            <div className="text-center py-10 text-white/30 text-sm">Poll이 없습니다</div>
          )}
          <div className="grid grid-cols-1 gap-3">
            {pollData.polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} onStatusChange={handleStatusChange} />
            ))}
          </div>
          <Pagination page={pollData.page} totalPages={pollData.totalPages} onPage={setPollPage} />
        </section>
      </div>
    </div>
  );
}
