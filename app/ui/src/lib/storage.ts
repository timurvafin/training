// Слой localStorage. Ключи и семантика — те же, что в vanilla index.html.
import type { Session, Plan } from './types.ts'

const K = {
  session: 'session_state',
  plansCache: 'plans_cache',
  planPrefix: 'plan_cache:',
  planName: 'plan_name',
  lastWeek: 'last_week',
  lastDay: 'last_day',
  secret: 'shared_secret',
  timer: 'rest_timer',
  muted: 'rest_muted',
}

// Тихий режим сигнала окончания отдыха (звук+вибрация). По умолчанию выключен (звук есть).
export function getMuted(): boolean {
  try { return localStorage.getItem(K.muted) === '1' } catch (e) { return false }
}
export function setMuted(v: boolean): boolean {
  try { localStorage.setItem(K.muted, v ? '1' : '0'); return true } catch (e) { return false }
}

export function loadSessionState(): Session | null {
  try { return JSON.parse(localStorage.getItem(K.session) as string) } catch (e) { return null }
}
export function saveSessionState(state: Session): boolean {
  try { if (state) localStorage.setItem(K.session, JSON.stringify(state)); return true } catch (e) { return false }
}

// ——— Rest-таймер: персист отдельным ключом (не часть session_state, переживает «Начать заново») ———
export function loadTimer(): unknown {
  try { return JSON.parse(localStorage.getItem(K.timer) as string) } catch (e) { return null }
}
export function saveTimer(plain: unknown): boolean {
  try {
    if (plain == null) localStorage.removeItem(K.timer)
    else localStorage.setItem(K.timer, JSON.stringify(plain))
    return true
  } catch (e) { return false }
}

export function cachePlan(plan: Plan): void {
  try { localStorage.setItem(K.planPrefix + plan.plan, JSON.stringify(plan)) } catch (e) {}
}
export function loadCachedPlan(name: string): Plan | null {
  try { return JSON.parse(localStorage.getItem(K.planPrefix + name) as string) } catch (e) { return null }
}

export function loadPlansCache(): string[] {
  try { return JSON.parse(localStorage.getItem(K.plansCache) as string) || [] } catch (e) { return [] }
}
export function savePlansCache(plans: string[]): void {
  try { localStorage.setItem(K.plansCache, JSON.stringify(plans)) } catch (e) {}
}

export function getPlanName(): string { try { return localStorage.getItem(K.planName) || '' } catch (e) { return '' } }
export function setPlanName(name: string): boolean { try { localStorage.setItem(K.planName, name); return true } catch (e) { return false } }

// Последние выбранные неделя/день (по плану) — чтобы старт восстанавливал прошлый выбор,
// а не дефолты (последняя неделя / первый день). Валидируются при восстановлении в initAfterPlan.
export function getLastWeek(): string { try { return localStorage.getItem(K.lastWeek) || '' } catch (e) { return '' } }
export function setLastWeek(w: string): boolean { try { localStorage.setItem(K.lastWeek, w == null ? '' : w); return true } catch (e) { return false } }
export function getLastDay(): string { try { return localStorage.getItem(K.lastDay) || '' } catch (e) { return '' } }
export function setLastDay(d: string): boolean { try { localStorage.setItem(K.lastDay, d == null ? '' : d); return true } catch (e) { return false } }

export function getSecret(): string { try { return localStorage.getItem(K.secret) || '' } catch (e) { return '' } }
export function setSecret(s: string): boolean { try { localStorage.setItem(K.secret, s == null ? '' : s); return true } catch (e) { return false } }
