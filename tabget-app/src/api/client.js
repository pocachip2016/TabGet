// Build-time dispatch: VITE_USE_MOCK=true → mockClient, otherwise realClient.
// Vite replaces import.meta.env constants at build time and dead-code-eliminates
// the unused branch, so only one implementation ends up in the bundle.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const impl = USE_MOCK
  ? await import('./mockClient.js')
  : await import('./realClient.js');

export const ApiError           = impl.ApiError;
export const fetchPolls         = impl.fetchPolls;
export const submitVote         = impl.submitVote;
export const fetchMessages      = impl.fetchMessages;
export const triggerBattleTick  = impl.triggerBattleTick;
export const fetchAdminPolls    = impl.fetchAdminPolls;
export const activateAllPending = impl.activateAllPending;
export const patchPollStatus    = impl.patchPollStatus;
export const fetchTrendLogs     = impl.fetchTrendLogs;
export const runCuration        = impl.runCuration;
