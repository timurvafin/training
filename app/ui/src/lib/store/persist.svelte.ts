// Персист сессии в localStorage (snapshot + debounce) и базовые селекторы (planName/isLocked).
// Выделен из session, чтобы разорвать циклы импортов: и session, и sync, и plan зависят от
// save/flushSave/planName, но НЕ должны импортировать друг друга ради них. Зависит только от
// appState + storage (лист графа модулей).
import { app, setStatus } from './appState.svelte.js'
import * as storage from '../storage.js'

export function planName(): string {
  return (app.plan && app.plan.plan) || storage.getPlanName() || ''
}

// Сессия «заблокирована» (перезаписать нельзя): успешно отправлена или идёт финализация.
export function isLocked(): boolean {
  return !!(app.session && (app.session.synced || app.session.finalizing))
}

// Синхронная запись снапшота сессии в localStorage. Здесь — единственное место записи.
function writeSession(): void {
  if (app.session && !storage.saveSessionState($state.snapshot(app.session))) {
    setStatus('s-err', 'Не удалось сохранить локально (память браузера)')
  }
}

// Дебаунс localStorage-записи для частых правок (ввод в touch()) → нет jank на мобильном.
// Структурные изменения зовут save() напрямую (= flush, надёжно). flushSave() пишет немедленно
// и снимает отложенный таймер — вызывается на visibilitychange(hidden)/pagehide (сохранность).
const SAVE_DEBOUNCE_MS = 350
let saveIv: ReturnType<typeof setTimeout> | null = null // id отложенной записи; null когда нечего флашить
let savePending = false // есть незаписанный снапшот (для flush)

export function flushSave(): void {
  if (saveIv != null) { clearTimeout(saveIv); saveIv = null }
  if (!savePending) return
  savePending = false
  writeSession()
}

// Надёжное сохранение «сейчас» (структурные изменения): пишем сразу, снимаем debounce.
export function save(): void {
  flushSave() // на случай ранее отложенной записи — не потерять её и не записать дважды-устаревшее
  writeSession()
}

// Отложенное сохранение для частого ввода (trailing). Гарантия — flushSave() на скрытии/закрытии.
function saveDebounced(): void {
  savePending = true
  if (typeof setTimeout === 'undefined') { flushSave(); return }
  if (saveIv != null) clearTimeout(saveIv)
  saveIv = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
}

export function touch(): void {
  if (!app.session) return
  // Правка инвалидирует незавершённую попытку финиша: замороженный payload и ↻ убираем,
  // чтобы ретрай не отправил устаревший снимок — пользователь завершит заново.
  if (app.session.payload && !app.session.synced) {
    app.session.payload = null
    app.session.finalizing = false
    app.showRetry = false
  }
  app.session._dirty = true
  // Частый путь (ввод reps/weight/rpe/note) — дебаунснутая запись, чтобы не дёргать localStorage
  // на каждый символ. Сохранность гарантируют flushSave() на visibilitychange(hidden)/pagehide
  // и явный save() в структурных действиях (toggleDone/addSet/removeSet и т.д.).
  saveDebounced()
}
