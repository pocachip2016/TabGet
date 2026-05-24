export const RULE_VIEW_KEY = 'tabget:ruleViewCount';
export const MAX_RULE_VIEWS = 3;

export function getRuleViewCount() {
  try {
    const raw = localStorage.getItem(RULE_VIEW_KEY);
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export function incrementRuleViewCount() {
  try {
    const next = getRuleViewCount() + 1;
    localStorage.setItem(RULE_VIEW_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

export function shouldShowRules() {
  return getRuleViewCount() < MAX_RULE_VIEWS;
}
