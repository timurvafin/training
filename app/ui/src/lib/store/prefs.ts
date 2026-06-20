// Серверный персист настроек выбора (план/неделя/день/звук) + секрет записи.
// Единственный источник правды — серверный PropertiesService (через bootstrap/setPrefs).
// localStorage НЕ используем (ломается в third-party iframe Apps Script на Safari/iOS).
// Геттеры СИНХРОННЫЕ (читают in-memory cache, заполняется applyPrefs из bootstrap) — сигнатуры как раньше.
import * as api from '../api.js'
import type { Prefs } from '../types.ts'

// In-memory cache — единственный источник для синхронных геттеров (живёт на время загрузки страницы).
const cache: Prefs = {}

// Заполнить cache серверными prefs (из bootstrap). Вызывается один раз при старте до initAfterPlan.
export function applyPrefs(p: Prefs | null | undefined): void {
  const src = p && typeof p === 'object' ? p : {}
  if (src.plan_name != null) cache.plan_name = src.plan_name
  if (src.last_week != null) cache.last_week = src.last_week
  if (src.last_day != null) cache.last_day = src.last_day
  if (src.muted != null) cache.muted = !!src.muted
  // Секрет приходит с сервера (SHARED_SECRET) — клиент его только кэширует, на сервер не пишет.
  if (src.secret != null) cache.secret = src.secret
}

// ——— Синхронные геттеры (только cache) ———
export function getPlanName(): string { return cache.plan_name ?? '' }
export function getLastWeek(): string { return cache.last_week ?? '' }
export function getLastDay(): string { return cache.last_day ?? '' }
export function getSecret(): string { return cache.secret ?? '' }
export function getMuted(): boolean { return cache.muted ?? false }

// ——— Сеттеры: cache + немедленный push на сервер (редкие действия, без debounce) ———
export function setPlanName(v: string): boolean { cache.plan_name = v ?? ''; pushPrefs(); return true }
export function setLastWeek(v: string): boolean { cache.last_week = v ?? ''; pushPrefs(); return true }
export function setLastDay(v: string): boolean { cache.last_day = v ?? ''; pushPrefs(); return true }
export function setMuted(v: boolean): boolean { cache.muted = !!v; pushPrefs(); return true }
// Секрет записи (getSecret) приходит с сервера (SHARED_SECRET) через applyPrefs — клиент его НЕ задаёт.

// ——— Отправка полного снимка на сервер (last-write-wins). Сериализуем, чтобы не было гонок. ———
let pushing = false
let pendingPush = false
export function pushPrefs(): void {
  if (pushing) { pendingPush = true; return }
  pushing = true
  const snapshot: Prefs = {
    plan_name: cache.plan_name ?? '',
    last_week: cache.last_week ?? '',
    last_day: cache.last_day ?? '',
    muted: cache.muted ?? false,
  }
  api.setPrefs(snapshot)
    .catch(() => {}) // best-effort
    .finally(() => { pushing = false; if (pendingPush) { pendingPush = false; pushPrefs() } })
}

// На pagehide/visibility:hidden — добить отложенный push (обычно nothing pending, т.к. пишем сразу).
export function flushPrefs(): void {
  if (pendingPush && !pushing) pushPrefs()
}
