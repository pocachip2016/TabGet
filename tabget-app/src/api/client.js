const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function fetchPolls(visitorId) {
  const url = `${API_BASE}/polls${visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(`Failed to fetch polls: ${res.status}`, { status: res.status });
  }
  return res.json();
}

export async function fetchAdminPolls({ page = 1, limit = 10, status = 'ALL', runAt = null } = {}) {
  const params = new URLSearchParams({ page, limit, status });
  if (runAt) params.set('runAt', runAt);
  const res = await fetch(`${API_BASE}/admin/polls?${params}`);
  if (!res.ok) throw new ApiError(`Failed: ${res.status}`, { status: res.status });
  return res.json();
}

export async function activateAllPending() {
  const res = await fetch(`${API_BASE}/admin/polls/activate-pending`, { method: 'POST' });
  if (!res.ok) throw new ApiError(`Failed: ${res.status}`, { status: res.status });
  return res.json();
}

export async function patchPollStatus(pollId, status) {
  const res = await fetch(`${API_BASE}/admin/polls/${encodeURIComponent(pollId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new ApiError(`Failed: ${res.status}`, { status: res.status });
  return res.json();
}

export async function fetchTrendLogs({ page = 1, limit = 5 } = {}) {
  const params = new URLSearchParams({ page, limit });
  const res = await fetch(`${API_BASE}/admin/trend-logs?${params}`);
  if (!res.ok) throw new ApiError(`Failed: ${res.status}`, { status: res.status });
  return res.json();
}

export async function runCuration() {
  const res = await fetch(`${API_BASE}/run-curation`, { method: 'POST' });
  if (!res.ok) throw new ApiError(`Failed: ${res.status}`, { status: res.status });
  return res.json();
}

export async function submitVote(pollId, side, visitorId) {
  const res = await fetch(`${API_BASE}/polls/${encodeURIComponent(pollId)}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side, visitorId }),
  });

  if (res.ok) return res.json();

  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }

  if (res.status === 409) {
    throw new ApiError('already_voted', { status: 409, code: 'already_voted' });
  }
  if (res.status === 423) {
    throw new ApiError('voting_closed', { status: 423, code: 'voting_closed' });
  }
  throw new ApiError(body?.error ?? `Vote failed: ${res.status}`, { status: res.status });
}
