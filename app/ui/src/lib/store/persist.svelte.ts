// Селекторы сессии (planName/isLocked). Сессия НЕ персистится — живёт только в памяти страницы:
// черновики не храним, а localStorage в third-party iframe (Apps Script на iOS) ненадёжен.
// save/flushSave оставлены как no-op, чтобы не трогать многочисленные вызовы в session/plan/sync.
// Зависит только от appState + storage (prefs-реэкспорт).
import { app } from './appState.svelte.js'
import * as storage from '../storage.js'

export function planName(): string {
  return (app.plan && app.plan.plan) || storage.getPlanName() || ''
}

// Сессия «заблокирована» (перезаписать нельзя): успешно отправлена, идёт финализация ИЛИ это read-only
// просмотр выполненного дня (он строится с synced=true).
export function isLocked(): boolean {
  return !!(app.session && (app.session.synced || app.session.finalizing))
}

// Персиста сессии нет (in-memory). No-op — вызовы в session/plan/sync остаются безвредными.
export function flushSave(): void {}
export function save(): void {}

// Правка подхода: инвалидирует незавершённую попытку финиша (замороженный payload и ↻ убираем,
// чтобы ретрай не отправил устаревший снимок) и помечает сессию «грязной» для guard-подтверждений.
export function touch(): void {
  if (!app.session) return
  if (app.session.payload && !app.session.synced) {
    app.session.payload = null
    app.session.finalizing = false
    app.showRetry = false
  }
  app.session._dirty = true
}
