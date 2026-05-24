// 브라우저 fullscreen 진입 (사용자 제스처 필요). 이미 진입 상태거나 실패해도 조용히 무시.
export function enterFullscreen() {
  if (document.fullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (!req) return;
  try { req.call(el)?.catch?.(() => {}); } catch { /* noop */ }
}
