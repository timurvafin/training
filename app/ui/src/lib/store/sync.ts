// Синхронизация факта с сервером (идемпотентно по session_id), online/visibility/pagehide
// слушатели и derived-статус для SyncLine. Настройки (план/неделя) — в settings.ts (чтобы syncNow
// не зависел от plan/session). Зависит от persist (save/flushSave), restTimer, state, api.
import { app, setStatus } from './appState.svelte.js'
import * as storage from '../storage.js'
import * as api from '../api.js'
import { buildPayload } from '../state.js'
import { save, flushSave } from './persist.svelte.js'
import { settleOnVisible } from './restTimer.js'
import type { SessionPayload, CardioPayload, SyncState } from '../types.ts'

export async function syncNow(): Promise<void> {
  const s = app.session
  if (!s) return
  if (s.synced) { setStatus('s-ok', 'Уже отправлено ✓'); app.showRetry = false; return }
  if (s._submitting) return
  const base = s.payload || buildPayload(s, storage.getSecret())
  if (!base) { setStatus('s-err', 'Нет заполненных подходов'); return }
  const payload = { ...base, shared_secret: storage.getSecret() } // свежий секрет
  s.payload = payload
  s._submitting = true
  save()
  // Реальный offline (или mock-offline в dev) ловится ниже через reject промиса gas() → catch.
  const sid = s.session_id // guard против устаревшего callback
  const cardio = !!s.cardio
  setStatus('s-sync', 'Синхронизация…')
  app.showRetry = false
  try {
    // payload.cardio-ветка дискриминируется рантайм-флагом s.cardio; статически TS его не сужает — отсюда as.
    const res = await (cardio ? api.saveCardio(payload as CardioPayload) : api.saveSession(payload as SessionPayload))
    if (!app.session || app.session.session_id !== sid) return // сессия сменилась — игнор
    app.session._submitting = false
    app.session.finalizing = false // попытка финиша завершена (успех/отказ) — снять лок
    if (res && res.ok) {
      app.session.synced = true
      setStatus('s-ok', 'Сохранено ✓ (' + (res.duplicate ? 'уже было' : 'ок') + ')')
      app.showRetry = false
    } else {
      setStatus('s-err', 'Отказ: ' + ((res && res.error) || 'ошибка'))
      app.showRetry = true
    }
    save() // persist терминального результата (synced и/или _submitting=false)
  } catch (err) {
    if (!app.session || app.session.session_id !== sid) return
    app.session._submitting = false
    app.session.finalizing = false // снять лок, чтобы не застрять (вкл. таймаут зависшего запроса)
    save()
    setStatus('s-local', 'Ошибка сети — сохранено локально. Нажми ↻: ' + ((err as Error)?.message || err))
    app.showRetry = true
  }
}

// Регистрирует online/visibilitychange/pagehide listeners и ВОЗВРАЩАЕТ disposer, снимающий их все.
// Disposer обязателен: без него HMR/повторный mount плодят дубли хендлеров. В App.svelte
// onMount возвращает результат этого вызова — Svelte вызовет disposer на destroy.
export function initOnlineListener(): () => void {
  const onOnline = () => {
    if (app.session && !app.session.synced && app.session.payload && !app.session._submitting) syncNow()
  }
  // Возврат вкладки из фона: setInterval в фоне тротлится — при показе пересчитываем now
  // и сразу закрепляем переотдых, чтобы таймер «доехал» без задержки до ближайшего тика.
  // Уход вкладки в фон (hidden) — момент надёжно сбросить отложенную localStorage-запись.
  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flushSave()
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    settleOnVisible()
  }
  // pagehide — последний надёжный момент перед выгрузкой/bfcache: дописать отложенный снапшот.
  const onPageHide = () => flushSave()

  const hasWindow = typeof window !== 'undefined'
  const hasDocument = typeof document !== 'undefined'
  if (hasWindow) {
    window.addEventListener('online', onOnline)
    window.addEventListener('pagehide', onPageHide)
  }
  if (hasDocument) document.addEventListener('visibilitychange', onVisibility)

  // Disposer: снять всё, что добавили (в т.ч. pagehide-flush из п.2).
  return () => {
    if (hasWindow) {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', onPageHide)
    }
    if (hasDocument) document.removeEventListener('visibilitychange', onVisibility)
  }
}

// ——— Derived-статус синка для SyncLine (чисто на чтение, ничего не отправляет) ———
// idle (черновик) | sync (отправляем) | ok (отправлено) | off (оффлайн/ошибка — нужен ретрай).
export function syncStatus(): SyncState {
  const s = app.session
  if (!s) return 'idle'
  if (s._submitting) return 'sync'
  if (s.synced) return 'ok'
  // 'off' (виден ретрай) — только когда есть что повторять: замороженный payload неудачной
  // отправки (app.showRetry). Свежий офлайн-черновик без payload остаётся 'idle' (скрыт),
  // чтобы плашка не всплывала в черновике просто из-за отсутствия сети.
  if (app.showRetry) return 'off'
  return 'idle'
}
