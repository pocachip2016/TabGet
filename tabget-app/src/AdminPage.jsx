import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Play, CheckCircle, Clock, Archive, AlertCircle, X } from 'lucide-react';
import { fetchAdminPolls, patchPollStatus, fetchTrendLogs, runCuration, activateAllPending } from './api/client';

const STATUS_OPTIONS = ['ALL', 'PENDING', 'ACTIVE', 'ARCHIVED'];

const STATUS_STYLE = {
  PENDING:  { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  ACTIVE:   { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  ARCHIVED: { bg: 'bg-gray-100',   text: 'text-gray-500',   icon: Archive },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? { bg: 'bg-gray-100', text: 'text-gray-500', icon: AlertCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <Icon size={12} /> {status}
    </span>
  );
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-sm text-gray-500 font-medium">{page} / {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function ProductImage({ url, name }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center gap-1 text-gray-400">
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
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Images */}
      <div className="flex h-48 relative">
        <div className="relative flex-1 overflow-hidden">
          <ProductImage url={a.imageUrl} name={a.name} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <p className="absolute bottom-3 left-3 text-white text-sm font-bold truncate right-3 drop-shadow">{a.name}</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="relative flex-1 overflow-hidden">
          <ProductImage url={b.imageUrl} name={b.name} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          <p className="absolute bottom-3 left-3 text-white text-sm font-bold truncate right-3 drop-shadow">{b.name}</p>
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <StatusBadge status={poll.status} />
          <button
            onClick={handleStatusClick}
            disabled={changing}
            className="text-xs px-3 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white font-bold transition disabled:opacity-40 backdrop-blur-sm"
          >
            {changing ? '...' : `→ ${nextStatus}`}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 py-3 space-y-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{poll.category}</p>
          <p className="text-base text-gray-900 font-semibold leading-snug">{poll.themeTitle}</p>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{poll.votesA.toLocaleString()}표 ({pctA}%)</span>
            <span>{poll.votesB.toLocaleString()}표 ({pctB}%)</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
            <div className="bg-blue-400 transition-all duration-300" style={{ width: `${pctA}%` }} />
            <div className="bg-pink-400 transition-all duration-300" style={{ width: `${pctB}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{total.toLocaleString()}명 참여</p>
        </div>
        {poll.curatorNote && (
          <p className="text-xs text-gray-500 italic line-clamp-2">"{poll.curatorNote}"</p>
        )}
        <p className="text-xs text-gray-400">
          {new Date(poll.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        </p>
      </div>
    </div>
  );
}

function toDateKey(isoStr) {
  return new Date(isoStr).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function toTimeStr(isoStr) {
  return new Date(isoStr).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function RunChips({ logs, totalLogs, selectedRun, onSelect, loading, page, totalPages, onPage }) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => onSelect(null)}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
            !selectedRun ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          전체
        </button>
        {loading && <span className="text-xs text-gray-400 self-center">불러오는 중...</span>}
        {!loading && logs.length === 0 && <span className="text-xs text-gray-400 self-center">실행 기록 없음</span>}
        {!loading && logs.map((log, i) => {
          const runNo = totalLogs - (page - 1) * 20 - i;
          const isSelected = selectedRun?.id === log.id;
          return (
            <button
              key={log.id}
              onClick={() => onSelect(isSelected ? null : log)}
              className={`shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                isSelected ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
            >
              <span>#{runNo}</span>
              <span className={`text-[9px] font-normal ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                {toTimeStr(log.createdAt)}
              </span>
            </button>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-2">
          <button onClick={() => onPage(page - 1)} disabled={page <= 1}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-gray-400">{page} / {totalPages}</span>
          <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [pollData, setPollData] = useState({ polls: [], total: 0, page: 1, totalPages: 1 });
  const [pollPage, setPollPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pollLoading, setPollLoading] = useState(false);
  const [pollError, setPollError] = useState(null);

  const [logData, setLogData] = useState({ logs: [], total: 0, page: 1, totalPages: 1 });
  const [logPage, setLogPage] = useState(1);
  const [logLoading, setLogLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);

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
    <div className="w-full min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-20 w-full bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="#" className="text-gray-400 hover:text-gray-700 transition">
              <X size={22} />
            </a>
            <h1 className="text-xl font-black">
              <span className="text-gray-900">Tap</span>
              <span style={{ color: '#E30B5C' }}>Get</span>
              <span className="text-gray-400 text-base font-normal ml-2">관리자</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleActivateAll}
              disabled={activating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-600 text-white transition-all active:scale-95 disabled:opacity-40"
            >
              <CheckCircle size={15} />
              {activating ? '처리 중...' : 'ACTIVE 전환'}
            </button>
            <button
              onClick={handleRunCuration}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: running ? '#aaa' : 'linear-gradient(135deg,#E30B5C,#c4084e)' }}
            >
              {running ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
              {running ? '실행 중...' : '에이전트 실행'}
            </button>
          </div>
        </div>
      </div>

      {/* Run result toast */}
      {runResult && (
        <div className="max-w-4xl mx-auto px-6">
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-bold ${runResult.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {runResult.ok ? `✓ ${runResult.count}개 Poll 생성 완료` : `✗ 실패: ${runResult.msg}`}
            <button onClick={() => setRunResult(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
        {/* Trend Logs */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">
              에이전트 실행 기록 <span className="text-gray-400 font-normal">({logData.total}회)</span>
            </h2>
            <button
              onClick={() => loadLogs(logPage)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
            >
              <RefreshCw size={14} className="text-gray-600" />
            </button>
          </div>
          <RunChips
            logs={logData.logs}
            totalLogs={logData.total}
            selectedRun={selectedRun}
            onSelect={handleSelectRun}
            loading={logLoading}
            page={logData.page}
            totalPages={logData.totalPages}
            onPage={setLogPage}
          />
        </section>

        {/* Poll List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-base font-bold text-gray-800 shrink-0">
                Poll 목록 <span className="text-gray-400 font-normal">({pollData.total}개)</span>
              </h2>
              {selectedRun && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-pink-100 text-pink-600 font-bold shrink-0">
                  {toDateKey(selectedRun.createdAt)} {toTimeStr(selectedRun.createdAt)}
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPollPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => loadPolls(pollPage, statusFilter)}
                className="ml-1 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
              >
                <RefreshCw size={14} className="text-gray-600" />
              </button>
            </div>
          </div>

          {pollLoading && <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>}
          {pollError && <div className="text-center py-8 text-red-500 text-sm">{pollError}</div>}
          {!pollLoading && !pollError && pollData.polls.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Poll이 없습니다</div>
          )}
          <div className="grid grid-cols-2 gap-4">
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
