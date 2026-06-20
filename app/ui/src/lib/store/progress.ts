// Факт выполненных дней (read-only) — derive из «Сессии»/«Кардио» на сервере.
// app.progress хранит факт для ТЕКУЩЕЙ недели; buildForDay решает: выполненный день → read-only из факта,
// иначе — обычная пустая форма из плана.
import { app } from './appState.svelte.js'
import * as api from '../api.js'
import { buildState, buildStateFromProgress } from '../state.js'
import { planName } from './persist.svelte.js'
import type { ProgressMap, PlanDay, Session } from '../types.ts'

export function applyProgress(p: ProgressMap | null | undefined): void {
  app.progress = p || {}
}

// День выполнен (есть запись в факте текущей недели)?
export function dayDone(dayId: string): boolean {
  return !!(app.progress && app.progress[dayId])
}

// Перезагрузить факт для недели. Токен против устаревших ответов (гонка selectWeek/fetchPlan).
// Возвращает успех: при ошибке app.progress НЕ затирается (иначе выполненные дни молча разблокируются → дубль).
let progressSeq = 0
export async function refreshProgress(week: string): Promise<boolean> {
  if (!app.plan) return false
  const seq = ++progressSeq
  const plan = app.plan.plan ?? ''
  try {
    const m = await api.getProgress(plan, week)
    if (seq !== progressSeq) return false // устаревший ответ — игнор
    app.progress = m
    return true
  } catch (e) {
    return false // факт неизвестен — не разблокируем выполненные дни
  }
}

// Сессия для дня+недели: read-only из факта, если день выполнен; иначе пустая форма из плана.
export function buildForDay(day: PlanDay, week: string): Session {
  const prog = app.progress && app.progress[day.day_id]
  return prog ? buildStateFromProgress(day, week, planName(), prog) : buildState(day, week, planName())
}
