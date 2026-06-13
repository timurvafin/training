// timer.ts — чистый rest-таймер для трекера тренировок.
//
// Без Svelte / DOM / setInterval. Вся логика — чистые функции над состоянием,
// которое хранит АБСОЛЮТНЫЕ моменты времени (ms), а не «оставшиеся секунды».
// Текущее время `now` (Date.now()) передаётся явно во все запросы и переходы.
// Поэтому таймер не врёт в фоне / при блокировке экрана (UI просто перерисовывает
// по реальным часам) и переживает reload (сериализуем моменты, восстанавливаем по now).
//
// Форма состояния (TimerState):
//   {
//     exName: string,            // имя упражнения для подписи «Отдых · <name>»
//     total: number,            // исходная длительность отсчёта, сек (для прогресс-бара и «сверх M:SS»)
//     startedAt: number,        // ms, момент старта отсчёта (Date.now())
//     targetEndAt: number,      // ms, целевой момент окончания отдыха (момент, когда remaining=0)
//     pausedAt: number | null,  // ms, момент постановки на паузу; null если идёт
//     finished: boolean,        // достигли 0 → режим переотдыха (счёт вверх)
//     overStartedAt: number|null// ms, момент перехода в переотдых (когда стал finished)
//   }
//
// Инвариант для паузы: при паузе мы НЕ двигаем targetEndAt сразу; вместо этого
// `pausedAt` фиксирует «замороженный now», и все вычисления (derive) используют
// min(now, pausedAt-эффект) — см. effectiveNow(). При resume мы сдвигаем все
// моменты на длительность паузы, чтобы remaining/over продолжились с того же места.
import type { TimerState, TimerView } from './types.ts'

const SEC = 1000

function toMs(sec: number): number {
  return Math.round(sec * SEC)
}

// Эффективное «сейчас» с учётом паузы: на паузе время как будто застыло в pausedAt.
function effectiveNow(state: TimerState, now: number): number {
  return state.pausedAt != null ? state.pausedAt : now
}

// Старт отсчёта. `now` — текущий Date.now() (ms). totalSec — длительность отдыха (сек).
export function createTimer(exName: string, totalSec: number, now: number): TimerState {
  const total = Math.max(0, Math.floor(totalSec) || 0)
  return {
    exName: exName || '',
    total,
    startedAt: now,
    targetEndAt: now + toMs(total),
    pausedAt: null,
    finished: total <= 0,
    overStartedAt: total <= 0 ? now : null,
  }
}

// Пауза: фиксируем момент остановки. Идемпотентно (повторная пауза — no-op).
// Работает и в переотдыхе (finished).
export function pause(state: TimerState, now: number): TimerState {
  if (state.pausedAt != null) return state
  return { ...state, pausedAt: now }
}

// Продолжить: сдвигаем все абсолютные моменты вперёд на длительность простоя,
// чтобы remaining/over продолжились ровно с того места, где встали.
export function resume(state: TimerState, now: number): TimerState {
  if (state.pausedAt == null) return state
  const delta = now - state.pausedAt
  return {
    ...state,
    startedAt: state.startedAt + delta,
    targetEndAt: state.targetEndAt + delta,
    overStartedAt: state.overStartedAt != null ? state.overStartedAt + delta : null,
    pausedAt: null,
  }
}

// ±15 (и любой deltaSec): сдвигаем targetEndAt. Только пока НЕ finished.
// remaining не уходит в минус: минимум targetEndAt — это «сейчас» (effectiveNow),
// т.е. remaining не опустится ниже 0 (а при достижении 0 derive выставит finished).
export function adjust(state: TimerState, deltaSec: number, now: number): TimerState {
  if (state.finished) return state
  const eff = effectiveNow(state, now)
  const proposed = state.targetEndAt + toMs(deltaSec)
  const targetEndAt = Math.max(eff, proposed)
  // total держим ≥ исходного и ≥ нового план-остатка, чтобы прогресс-бар не переполнялся.
  const remainingMs = targetEndAt - state.startedAt
  const total = Math.max(state.total, Math.ceil(remainingMs / SEC))
  return { ...state, targetEndAt, total }
}

// «Пропустить» / «Готово» — завершить таймер совсем. Чистая функция → null
// (в сторе это будет `timer = skip(timer)` → убрать док). stop — синоним.
export function skip(_state: TimerState | null): null {
  return null
}
export const stop = skip

// Главный селектор: всё вычисляется из `now` и сохранённых моментов.
//   remaining — сек до конца отдыха, ≥0
//   over       — сек сверх (после 0), ≥0
//   running    — идёт (не на паузе)
//   finished   — достигли 0 (режим переотдыха)
//   progress   — 0..1, доля оставшегося (remaining/total), для прогресс-бара
export function derive(state: TimerState | null, now: number): TimerView {
  if (!state) {
    return { remaining: 0, over: 0, running: false, finished: false, progress: 0 }
  }
  const running = state.pausedAt == null
  const eff = effectiveNow(state, now)

  // Сначала смотрим, достигли ли нуля по реальному времени.
  const finished = state.finished || eff >= state.targetEndAt

  if (!finished) {
    const remainingSec = Math.max(0, Math.ceil((state.targetEndAt - eff) / SEC))
    const progress = state.total > 0 ? Math.max(0, Math.min(1, remainingSec / state.total)) : 0
    return { remaining: remainingSec, over: 0, running, finished: false, progress }
  }

  // Переотдых: over растёт от момента достижения 0 (overStartedAt ?? targetEndAt).
  const overFrom = state.overStartedAt != null ? state.overStartedAt : state.targetEndAt
  const overSec = Math.max(0, Math.floor((eff - overFrom) / SEC))
  return { remaining: 0, over: overSec, running, finished: true, progress: 0 }
}

// Перевод состояния в режим finished «лениво» — вызывать в тике, когда derive
// показал finished, но в state ещё стоит finished:false. Закрепляет overStartedAt
// в targetEndAt, чтобы over считался строго от момента нуля (а не от now тика).
export function settleFinished(state: TimerState | null, now: number): TimerState | null {
  if (!state || state.finished) return state
  const eff = effectiveNow(state, now)
  if (eff < state.targetEndAt) return state
  return { ...state, finished: true, overStartedAt: state.targetEndAt }
}

// ----- Сериализация для persist в localStorage -----
// state — уже чистый объект из чисел/строк/null, поэтому serialize по сути
// возвращает копию (на случай, если в state когда-то заведутся не-данные).
// restore просто принимает разобранный объект; «оживление» — это derive(restored, now)
// с актуальным now: моменты те же, поэтому remaining/over пересчитываются по реальным
// часам и таймер корректно «доезжает», даже если страницу перезагрузили в фоне.
export function serialize(state: TimerState | null): TimerState | null {
  if (!state) return null
  return {
    exName: state.exName,
    total: state.total,
    startedAt: state.startedAt,
    targetEndAt: state.targetEndAt,
    pausedAt: state.pausedAt,
    finished: state.finished,
    overStartedAt: state.overStartedAt,
  }
}

export function restore(plain: unknown): TimerState | null {
  if (!plain || typeof plain !== 'object') return null
  const p = plain as Partial<TimerState>
  // Битый/частичный JSON (нет обязательных числовых моментов) → null, а не TimerState с NaN/undefined.
  if (typeof p.total !== 'number' || typeof p.startedAt !== 'number' || typeof p.targetEndAt !== 'number') return null
  return {
    exName: p.exName || '',
    total: p.total,
    startedAt: p.startedAt,
    targetEndAt: p.targetEndAt,
    pausedAt: typeof p.pausedAt === 'number' ? p.pausedAt : null,
    finished: !!p.finished,
    overStartedAt: typeof p.overStartedAt === 'number' ? p.overStartedAt : null,
  }
}

// Утилита форматирования M:SS (для UI; в логике не используется, но полезно держать рядом).
export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}
