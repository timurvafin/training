// Rest-таймер (через чистый timer.ts).
// timer.ts хранит абсолютные моменты времени; UI считает remaining/over из (state, now).
// Здесь — только реактивный `now`-тик (setInterval 1с) и persist, без своей арифметики.
import { app } from './appState.svelte.js'
import * as storage from '../storage.js'
import * as timer from '../timer.js'
import * as feedback from '../feedback.js'
import type { TimerView } from '../types.ts'

let timerIv: ReturnType<typeof setInterval> | null = null // id интервала тика; null когда таймера нет

// Таймер не персистится (in-memory) — не переживает reload, как и сессия (черновики не храним). No-op.
function persistTimer(): void {}

// Тик включён, только пока app.timer != null. Идемпотентно: повторный вызов не плодит интервалы.
function ensureTick(): void {
  if (app.timer) {
    if (timerIv == null && typeof setInterval !== 'undefined') {
      timerIv = setInterval(() => {
        app.now = Date.now()
        if (!app.timer) return
        // «Лениво» закрепляем переход в переотдых (over от момента нуля, а не от now тика).
        const wasFinished = app.timer.finished
        const settled = timer.settleFinished(app.timer, app.now)
        if (settled !== app.timer) {
          app.timer = settled
          persistTimer()
          // Момент пересечения нуля (живой тик) → сигнал «отдых окончен» один раз.
          if (!wasFinished && settled && settled.finished) feedback.signalRestEnd(app.muted)
        }
      }, 1000)
    }
  } else if (timerIv != null) {
    clearInterval(timerIv)
    timerIv = null
  }
}

// Старт/перезапуск rest-таймера. totalSec — длительность отдыха (сек). Пустой rest → no-op.
export function startRestTimer(exName: string, totalSec: number): void {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0))
  if (!sec) return
  feedback.unlockAudio() // старт по тапу пользователя — момент разблокировать аудио
  app.now = Date.now()
  app.timer = timer.createTimer(exName || '', sec, app.now)
  ensureTick()
  persistTimer()
}

// Пауза/продолжение по текущему derive.running. Тик при паузе не нужен (на паузе now не влияет),
// но останавливать его не обязательно — derive на паузе возвращает замороженный remaining/over.
export function pauseTimer(): void {
  if (!app.timer) return
  app.now = Date.now()
  app.timer = timer.pause(app.timer, app.now)
  persistTimer()
}
export function resumeTimer(): void {
  if (!app.timer) return
  app.now = Date.now()
  app.timer = timer.resume(app.timer, app.now)
  persistTimer()
}
// Удобный тоггл по derive.running (UI тапает по большой ячейке времени).
export function toggleTimer(): void {
  if (!app.timer) return
  if (timer.derive(app.timer, Date.now()).running) pauseTimer()
  else resumeTimer()
}

// ±15 (и любой deltaSec). До нуля сдвигает targetEndAt; в переотдыхе timer.adjust — no-op.
export function adjustTimer(deltaSec: number): void {
  if (!app.timer) return
  app.now = Date.now()
  app.timer = timer.adjust(app.timer, deltaSec, app.now)
  persistTimer()
}

// «Пропустить»/«Готово» — убрать док и почистить интервал.
export function skipTimer(): void {
  app.timer = timer.skip(app.timer) // → null
  ensureTick()
  persistTimer()
}

// Селектор для UI: производный вид таймера (remaining/over/running/finished/progress).
export function timerView(): TimerView {
  return timer.derive(app.timer, app.now)
}

// Тихий режим: вкл/выкл звук+вибрацию сигнала окончания отдыха (persist в серверных prefs).
export function toggleMute(): void {
  app.muted = !app.muted
  storage.setMuted(app.muted)
  if (!app.muted) feedback.unlockAudio() // размьют — это user-gesture, разблокируем аудио
}

// Тихая очистка таймера (смена дня/недели/сессии, finish) — без сохранения «пустого» как факта.
export function clearTimer(): void {
  if (app.timer == null && timerIv == null) return
  app.timer = null
  ensureTick()
  persistTimer()
}

// Возврат вкладки из фона: setInterval в фоне тротлится — при показе пересчитываем now
// и сразу закрепляем переотдых, чтобы таймер «доехал» без задержки до ближайшего тика.
export function settleOnVisible(): void {
  if (!app.timer) return
  app.now = Date.now()
  const settled = timer.settleFinished(app.timer, app.now)
  if (settled !== app.timer) { app.timer = settled; persistTimer() }
}
